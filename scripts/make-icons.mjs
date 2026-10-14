// Regenerate the PWA icon set: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const GREEN = "#198a00";
const DEEP = "#0d5c00";

const pin = `
  <path d="M256 96 C177.8 96 114 159.8 114 238 C114 331.6 256 452 256 452 C256 452 398 331.6 398 238 C398 159.8 334.2 96 256 96 Z" fill="#ffffff"/>
  <circle cx="256" cy="236" r="64" fill="${DEEP}"/>
  <path d="M225 236 l22 24 l48 -52" fill="none" stroke="#ffffff" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>
`;

// `scale` shrinks the artwork into the maskable safe zone, `radius` rounds the tile.
const svg = ({ radius, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="${radius}" fill="${GREEN}"/>
  ${radius ? "" : `<rect width="512" height="512" fill="${GREEN}"/>`}
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${pin}</g>
</svg>`;

const out = join(process.cwd(), "public", "icons");
mkdirSync(out, { recursive: true });

const jobs = [
  ["icon-192.png", { radius: 104, scale: 1 }, 192],
  ["icon-512.png", { radius: 104, scale: 1 }, 512],
  ["maskable-192.png", { radius: 0, scale: 0.78 }, 192],
  ["maskable-512.png", { radius: 0, scale: 0.78 }, 512],
  ["apple-touch-icon.png", { radius: 0, scale: 0.9 }, 180],
  ["icon-32.png", { radius: 96, scale: 1 }, 32],
];

for (const [name, opts, size] of jobs) {
  const buf = await sharp(Buffer.from(svg(opts)))
    .resize(size, size)
    .png()
    .toBuffer();
  writeFileSync(join(out, name), buf);
  console.log(name, buf.length, "bytes");
}

writeFileSync(
  join(process.cwd(), "app", "icon.svg"),
  svg({ radius: 104, scale: 1 })
);
console.log("app/icon.svg written");
