> ⚠️ **NOTICE:** While this tool is currently functional, it has not nearly been battle-tested enough to ensure it works in most use-cases.

![svelte-bundle](https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2Fcwfyh1w8r8g4f2ap1hff.png)

## Usage
This tool can be used with `npx`:
```bash
npx svelte-bundle -i <input-dir> -o <output-dir>
```
### Full Documentation: [https://github.com/uhteddy/svelte-bundle/wiki](https://github.com/uhteddy/svelte-bundle/wiki)

# Svelte Bundle CLI

**Svelte Bundle CLI** is a simple command-line tool that allows you to bundle a Svelte application into a single `.html` file using Vite and SSR (Server-Side Rendering). The goal of this tool is to make it easy to bundle Svelte apps for deployment, particularly for cases where everything needs to be contained in a single file.

Just note, the purpose of this tool is **NOT** to bundle an entire Svelte app, in-fact it is highly discouraged due to the overhead of the generated file. The purpose of this is to expand the capabilities of svelte to work on systems like certain Content Management Systems (CMS) that only allow HTML, CSS, and JS. It also was created with SSR so that the generated file is SEO-safe where necessary elements are already hydrated.

Utilizing this you will be able to develop a page with the joy of svelte and be able to directly get a single `.html` file that you can utilize getting full use-case of svelte.

⚠️ **Note**: This tool is **NOT** made to function with SvelteKit natively, this takes a single `.svelte` file as input and will output a single `.html` file.

## Inspiration
This tool was inspired by the need I had when it came to updating the CMS for a company I worked for. They were looking for more custom content on their website which used an outdated CMS. Pages were only able to include HTML, CSS, and JS.

Pure HTML, CSS, and JS can be grainular and more-importantly, lacks the reactivity that Svelte has. Meaning, to develop certain features I had to focus a lot more on the "what to do" when data changes, rather than Svelte handling that for me.

So, I searched for tools around that could be of assistance. I found [figsvelte](https://github.com/thomas-lowry/figsvelte) which was of so much help in the underlying understanding of what to do. But, it did not accomplish all I was looking for. I needed a solution that didn't just generate an HTML file with JS that hydrated the page. Through a lot of tinkering around I was able to finally get the system to work.

I noticed through a lot of google searches I wasn't the only one looking for a solution like this, yet, I was unable to find one that addressed everything I was looking for. So, for this reason I have decided to build svelte-bundle to take care of this in a much more simplistic and CLI way.

## Features
- [x] Bundles Svelte applications
- [x] Outputs a single `.html` file ready for deployment.
- [x] CLI arguments for specifying input and output directories.
- [x] Tests and CI integration.
- [x] Handle CSS and assets within the bundled file.
- [x] Add tailwindcss support, **this is in beta**.
- [x] Implement error handling and more robust validation.
