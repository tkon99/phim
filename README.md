# PHIM
Practical Hypertext Image Module\
(backronym, née PostHTML IMages)

Flexible responsive images plugin for PostHTML, Rehype, Astro, and more. For people that like performance but hate paying attention to it.

---

## Usage
PHIM core (`phim_core.mjs`) can work with either HTML input or an image source (url) input. It is made to be framework independent and adding support for a new framework only requires you to write some boilerplate component code (and the framework should allow for asynchronous code in components).
```
// Coming soon
```

---

### What?
PHIM aims to be a flexible image optimization module that does not get in your way. It operates by taking HTML output from anywhere, looking for images, and optimizing them, after which it returns the processed HTML (with a `picture` tag). This means your page is always fast and you do not waste visitor's data with unoptimized images.

PHIM always checks whether a file exists in the project's file system (given a certain assets directory [for now]) and can cache remote images too.

### Why?
I was dissatisfied with current "responsive images" solutions, particularly for static site generators. PostHTML, a popular framework for processing rendered HTML does not have a good image processor.

Other frameworks (like Astro, which I use for my new website) require you to `import` the image ahead of time using the desired responsive sizes as url parameters. This was incompatible with my desire for simplicity in content writing. I do not want to think about optimizing images, it should just happen, i.e. be part of the build process (not the content writing process).

### How does this compare to...
It's probably pretty bad. I am by no means an experienced software developer and this is just one of many side-projects. The core PHIM module is quite flexible (and enough so for me) but there will be a roadmap below to make it a bit more robust. PRs are welcome.

---
## Roadmap
- [ ] Core - Create better RootDir fallback
- [ ] Core - Improve local image detection (before fetching remote)
- [ ] Core - Improve file system operations
- [ ] Core - Attempt to move entirely to ES6 module/`import`
- [ ] Docs - Document usage of Astro component
- [ ] Support - Add Rehype plugin
- [ ] Add package.json / support importing Astro component
- [ ] Publish to NPM