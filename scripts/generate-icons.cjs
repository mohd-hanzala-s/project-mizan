// One-off generator for public/icons/*.png. Run with: node scripts/generate-icons.cjs
// Uses pureimage (pure JS, no native bindings) so it works in network-restricted
// sandboxes. Not part of the app bundle or build pipeline — icons are committed
// as static assets afterward.
const PImage = require("pureimage");
const fs = require("fs");
const path = require("path");

const EMERALD = { r: 16, g: 185, b: 129, a: 255 }; // #10B981 — theme_color
const WHITE = { r: 255, g: 255, b: 255, a: 255 };

function drawIcon(size, { safeZonePadding = 0 } = {}) {
  const img = PImage.make(size, size);
  const ctx = img.getContext("2d");

  ctx.fillStyle = `rgba(${EMERALD.r},${EMERALD.g},${EMERALD.b},1)`;
  ctx.fillRect(0, 0, size, size);

  // Simple ascending-bars mark (Dashboard/analytics motif), inset so it sits
  // inside the maskable safe zone (inner 80%) when safeZonePadding is set.
  const pad = size * (safeZonePadding || 0.16);
  const usable = size - pad * 2;
  const barCount = 3;
  const gap = usable * 0.14;
  const barWidth = (usable - gap * (barCount - 1)) / barCount;
  const heights = [0.45, 0.7, 1.0].map((f) => usable * f);

  ctx.fillStyle = `rgba(${WHITE.r},${WHITE.g},${WHITE.b},1)`;
  heights.forEach((h, i) => {
    const x = pad + i * (barWidth + gap);
    const y = pad + (usable - h);
    ctx.fillRect(x, y, barWidth, h);
  });

  return img;
}

async function writePng(img, filePath) {
  await PImage.encodePNGToStream(img, fs.createWriteStream(filePath));
  console.log("wrote", filePath);
}

async function main() {
  const outDir = path.join(__dirname, "..", "public", "icons");
  await writePng(
    drawIcon(192, { safeZonePadding: 0.16 }),
    path.join(outDir, "icon-192.png"),
  );
  await writePng(
    drawIcon(512, { safeZonePadding: 0.16 }),
    path.join(outDir, "icon-512.png"),
  );
  // Maskable needs a bigger safe-zone margin (inner 80% = ~0.1 padding per
  // side minimum; using 0.2 for a comfortable margin across OS mask shapes).
  await writePng(
    drawIcon(512, { safeZonePadding: 0.22 }),
    path.join(outDir, "icon-maskable-512.png"),
  );
  await writePng(
    drawIcon(180, { safeZonePadding: 0.16 }),
    path.join(__dirname, "..", "public", "apple-touch-icon.png"),
  );
}

main();
