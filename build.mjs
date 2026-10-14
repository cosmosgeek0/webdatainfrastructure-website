import { build } from 'esbuild';
const out='public';
await build({entryPoints:['src/app.js'],bundle:true,minify:true,format:'esm',target:'es2022',outdir:out,legalComments:'eof'});

import { readFile, writeFile } from 'node:fs/promises';
import { pages } from './src/pages.js';
const home=await readFile(`${out}/index.html`,'utf8');
const footer=home.slice(home.indexOf('<footer'),home.indexOf('<dialog')).replace(/href="#(?!top")/g,'href="/#');
const dialog=home.slice(home.indexOf('<dialog'),home.indexOf('</body>'));
const header=home.slice(home.indexOf('<a class="skip"'),home.indexOf('<main')).replaceAll('href="#','href="/#').replace('href="/#main"','href="#main"');
for(const [slug,page] of Object.entries(pages)){
 const head=home.slice(0,home.indexOf('<body')).replace(/<title>.*?<\/title>/,`<title>${page.title} — Web Data Infrastructure</title>`).replace(/(<meta name="description" content=")[^"]+/,`$1${page.description}`).replace(/(<meta property="og:title" content=")[^"]+/,`$1${page.title} — Web Data Infrastructure`).replace(/(<meta property="og:description" content=")[^"]+/,`$1${page.description}`).replaceAll('content="https://webdatainfrastructure.com/"',`content="https://webdatainfrastructure.com/${slug}"`).replace('rel="canonical" href="https://webdatainfrastructure.com/"',`rel="canonical" href="https://webdatainfrastructure.com/${slug}"`);
 const body=page.body.replace('<h2>Email us</h2>','<h2 id="concerns">Email us</h2>');
 await writeFile(`${out}/${slug}.html`,`${head}<body id="top" class="information-page">${header}<main id="main" class="wrap information"><div class="information-heading"><a class="breadcrumb" href="/">WDI /</a><h1>${page.title}</h1><p>${page.intro}</p>${page.updated?'<span class="policy-date">Updated 26 September 2026</span>':''}</div><div class="information-body">${body}</div></main>${footer}${dialog}</body></html>`);
}
await writeFile(`${out}/sitemap.xml`,`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['',...Object.keys(pages)].map(slug=>`<url><loc>https://webdatainfrastructure.com/${slug}</loc><lastmod>2026-09-26</lastmod></url>`).join('')}</urlset>\n`);
