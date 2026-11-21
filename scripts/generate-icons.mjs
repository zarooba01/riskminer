// Generuje ikony PWA z public/icons/icon.svg. Uruchom po zmianie logo: npm run icons
import sharp from "sharp";

const source = "public/icons/icon.svg";
const background = "#1f4fd8";

const round = (size) =>
  Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${size * 0.22}"/></svg>`);

// Ikony „any": zaokrąglone rogi na przezroczystym tle.
for (const size of [192, 512]) {
  await sharp(source, { density: 300 })
    .resize(size, size)
    .composite([{ input: round(size), blend: "dest-in" }])
    .png()
    .toFile(`public/icons/icon-${size}.png`);
}

// Maskable i apple-touch: pełne tło, system sam przycina kształt.
await sharp(source, { density: 300 }).resize(512, 512).flatten({ background }).png().toFile("public/icons/icon-maskable-512.png");
await sharp(source, { density: 300 }).resize(180, 180).flatten({ background }).png().toFile("src/app/apple-icon.png");
await sharp(source, { density: 300 })
  .resize(64, 64)
  .composite([{ input: round(64), blend: "dest-in" }])
  .png()
  .toFile("src/app/icon.png");

console.log("Ikony wygenerowane.");
