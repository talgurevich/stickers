// Builds the public logo + favicons from the source image.
//
// Usage: node scripts/build-logo.mjs <source.jpeg|.png>
//
// Outputs:
//   public/logo.png         — transparent-bg, tightly cropped
//   src/app/icon.png        — 256×256 square, dark bg, logo centered (Next.js auto-uses this as the site favicon)
//   src/app/apple-icon.png  — 180×180 same composition, for iOS home screen

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/build-logo.mjs <source>");
  process.exit(1);
}

// 1) Strip near-black to transparent + auto-trim → public/logo.png
const threshold = 50;
const { data, info } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

let cleared = 0;
for (let i = 0; i < data.length; i += 4) {
  if (
    data[i] <= threshold &&
    data[i + 1] <= threshold &&
    data[i + 2] <= threshold
  ) {
    data[i + 3] = 0;
    cleared++;
  }
}

const trimmed = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .png()
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();

await sharp(trimmed).toFile("public/logo.png");

// 2) Square favicons. The source is wide; we put it on a square dark canvas
//    with breathing room, since favicon tabs are square. Dark bg matches the
//    original sticker context and gives high contrast for the yellow letters.
async function squareIcon(size, outPath) {
  const targetW = Math.round(size * 0.86); // logo width inside the square
  const resized = await sharp(trimmed)
    .resize({ width: targetW, fit: "inside" })
    .png()
    .toBuffer();
  const meta = await sharp(resized).metadata();
  const composite = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 17, g: 17, b: 19, alpha: 1 }, // ~zinc-950
    },
  })
    .composite([
      {
        input: resized,
        top: Math.round((size - (meta.height ?? 0)) / 2),
        left: Math.round((size - (meta.width ?? 0)) / 2),
      },
    ])
    .png()
    .toBuffer();
  await mkdir(outPath.replace(/\/[^/]+$/, ""), { recursive: true });
  await sharp(composite).toFile(outPath);
}

await squareIcon(256, "src/app/icon.png");
await squareIcon(180, "src/app/apple-icon.png");

const logoMeta = await sharp("public/logo.png").metadata();
console.log(
  JSON.stringify({
    pixelsCleared: cleared,
    logo: { width: logoMeta.width, height: logoMeta.height },
    icons: ["src/app/icon.png (256×256)", "src/app/apple-icon.png (180×180)"],
  }),
);
