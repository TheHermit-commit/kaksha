// Packs the Vite build into one self-contained HTML page (CSS and JS inlined),
// for hosts that serve a single file. Usage: node scripts/single-file.mjs <out.html>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const js = html.match(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/)[1];
const css = html.match(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/)[1];
const fonts = html.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]+>/)[0];
const script = readFileSync(join(dist, js), 'utf8').replace(/<\/script/gi, '<\\/script');
const style = readFileSync(join(dist, css), 'utf8');

const page = `<title>Kaksha</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
<style>${style}</style>
<div id="root"></div>
<script type="module">${script}</script>
`;
writeFileSync(process.argv[2] ?? 'kaksha.html', page);
console.log('wrote', process.argv[2] ?? 'kaksha.html', Math.round(page.length / 1024), 'KB');
