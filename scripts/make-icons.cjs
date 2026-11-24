/* eslint-disable @typescript-eslint/no-require-imports */
// Renders scripts/icon.svg to the PNG sizes the PWA manifest needs.
(async () => {
const { chromium } = require("playwright");
const { readFileSync } = require("node:fs");
const svg = readFileSync(process.argv[2], "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
const out = [
  ["icon-192.png", 192, 0],
  ["icon-512.png", 512, 0],
  ["icon-maskable-512.png", 512, 0.12],
  ["apple-touch-icon.png", 180, 0],
];
for (const [name, size, pad] of out) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - pad * 2));
  await page.setContent(
    `<html><body style="margin:0;background:#2f4a7a;display:grid;place-items:center;width:${size}px;height:${size}px">` +
      `<div style="width:${inner}px;height:${inner}px">${svg.replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  await page.screenshot({ path: `public/icons/${name}` });
}
await browser.close();
console.log("icons ok");
})();
