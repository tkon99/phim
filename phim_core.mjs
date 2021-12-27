// Implement the old require function
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const cheerio = require('cheerio');

const axios = require('axios').default;
const fs = require("fs");
const pfs = fs.promises;
const Sharp = require("sharp");
const crypto = require("crypto");

Sharp.cache(false);

export default function phim (options) {

	let defaultOptions = {
		sizes: {
			"sm": 480,
			"md": 960,
			"lg": 1920
		},
		media: {
			"sm": "(max-width: 600px)",
			"md": "",
			"lg": "(min-width: 1200px)"
		},
		formats: {
			jpeg: { always: true, 	alpha: false, 	sharp: { quality: 80, progressive: true } },
			webp: { always: true,	alpha: true, 	sharp: { quality: 80, progressive: true } },
			png:  {	always: false,	alpha: true,	sharp: { compressionlevel: 8, progressive: true } }
		}
	}

	let { rootDir = "/", cache = false, dropRemoteParams = false, transformOptions = defaultOptions, debug = false} = options;

	/**
	 * getRemoteImage(url, filename); fetches a remote image and stores it in [filename]
	 */
	function getRemoteImage(url, filename) {
		return new Promise((res, rej) => {
			axios({
				method: 'get',
				url: url,
				responseType: 'stream'
			}).then((resp) => {
				resp.data.pipe(fs.createWriteStream(filename)).on('finish', res);
			});
		});
	}

	/**
	 * emptyPhimDir(), deletes all cached images
	 */
	async function emptyPhimDir() {
		let files = [];
		try {
			files = await pfs.readdir(rootDir+"/__phim/");
		}catch(e){
			throw e;
		}

		const promises = files.map(e => pfs.unlink(rootDir+"/__phim/"+e));
		await Promise.all(promises);
	}

	/**
	 * getFilename(url, local); takes a path/url (and bool whether image is local) and converts it to a stable hash
	 */
	function getFilename(url, local) {
		let hashableFilename;
		if(local){ 	// For local files, use filename
			let urlparts = url.split("/");
			hashableFilename = urlparts[urlparts.length - 1];
		}else{		// For remote files, use whole url, except when dropRemoteParams = true
			hashableFilename = url;
			if(dropRemoteParams){
				hashableFilename = hashableFilename.split('?')[0];
			}
		}

		return crypto.createHash("md5").update(hashableFilename).digest("hex").substr(0,20);
	}

	/**
	 * inCache(sting filename); takes a filename and checks if it is in the cache
	 */
	function inCache(filename) {
		return fs.existsSync(rootDir+'/__phim/'+filename);
	}

	/**
	 * giveFileExtension(filename); loads filename in Sharp, retrieves metadata and give the proper extension,
	 * returns object { filename (+ extension), metadata }
	 */
	async function giveFileExtension(filename) {
		let im = Sharp(rootDir+'/__phim/'+filename);
		let metadata = await im.metadata();
		let filetype = metadata.format;

		if(!inCache(filename+"."+filetype) || !cache){ // Check if renamed image in cache
			await pfs.copyFile(rootDir+'/__phim/'+filename, rootDir+'/__phim/'+filename+"."+filetype);
		}

		return {
			filename: filename+"."+filetype,
			filetype: filetype,
			orig_filename: filename,
			metadata: metadata
		}
	}

	/**
	 * transformImage(im_info); takes image info object (as given by giveFileExtension) and returns array of transformed images for html
	 */
	async function transformImage(im_info) {
		let transforms = [];
		let src_im = Sharp(rootDir+'/__phim/'+im_info.orig_filename);

		let promises = [];
		// Loop over possible target filetypes
		for (const [format, value] of Object.entries(transformOptions.formats)) {
			// Should we process this image using this format?
			if(value.always || format == im_info.filetype){
				// If image has alpha & format supports it, or the image does not have alpha
				if((im_info.metadata.hasAlpha && value.alpha) || !im_info.metadata.hasAlpha){
					// Good to process format, now consider each size

					for(const [size, width] of Object.entries(transformOptions.sizes)) {
						// Check if width is small enough (smaller or equal to the source)
						if(width <= im_info.metadata.width){
							// Process image
							let thisFile = im_info.orig_filename+"-"+size+"."+format;
							promises.push(
								src_im
									.resize({width: width})
									[format](transformOptions.formats[format].sharp)
									.toFile(rootDir+"/__phim/"+thisFile)
							);

							transforms.push({
								mime: "image/"+format,
								file: "/__phim/"+thisFile,
								w: width,
								media: transformOptions.media[size]
							});
						}
					}
				}
			}
		}

		await Promise.all(promises);

		await src_im
				.resize({width: Math.min(im_info.metadata.width, 1920)}) // TODO: make this not hardcoded
				[im_info.filetype](transformOptions.formats[im_info.filetype].sharp)
				.toFile(rootDir+"/__phim/"+im_info.filename)

		return transforms;
	}

	/**
	 * Takes image src, processes an image using just the url, core function that
	 * is called by Astro Image component and Rehype.
	 */
	async function processUrl(src) {
		let local = fs.existsSync(rootDir+src); // Potentially dangerous?

		// Get stable cache filename
		let filename = getFilename(src, local);

		if(debug) console.log("Processing: "+src);

		// Copy image over to phim dir
		if(!inCache(filename)){
			if(!local){
				// Want to fetch the image, then process as local
				await getRemoteImage(src, rootDir+'/__phim/'+filename);
			}else{
				await pfs.copyFile(rootDir+src, rootDir+'/__phim/'+filename);
			}
		}

		// Give image the appropriate file extension and construct object
		let im_info = await giveFileExtension(filename);

		// Transform image
		let transforms = await transformImage(im_info);

		return {im_info, transforms};
	}

	/**
	 * HTML: Main function to process each of the images that are found on the page
	 */
	async function processHTMLImage($, elem) {
		let src = $(elem).attr('src');
		
		let {im_info, transforms} = await processUrl(src);

		// Render to HTML
		$(elem).attr("src", '/__phim/'+im_info.filename); // Set phim optimized copy as fallback
		const orig_im = `${$.html(elem)}`; // Deep copy current html
		$(elem).replaceWith(
			 "<picture>"
			+transforms.map((x) => {
				return `<source type="${x.mime}" srcset="${x.file} ${x.w}w" media="${x.media}">`
			}).join('')
			+orig_im
			+"</picture>"
		);

		return;
	}

	/**
	 * HTML: Process page HTML (all images)
	 */
	async function processHTML(html) {
		let $ = cheerio.load(html);

		let promises = [];
		$('img').each((i,elem) => {
			let parentTag = $(elem).parent()[0].name;
			if (parentTag !== "picture"){ // True if already responsive
				promises.push(processHTMLImage($, elem));
			}
		});

		await Promise.all(promises);
		return $.html();
	}

	/**
	 * Return functions
	 */
	return {
		processHTML: processHTML,
		processUrl: processUrl
	}
};