// Genera el logo, el símbolo y los íconos de la PWA desde el logo original.
// Uso: node scripts/generate-brand.mjs
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const SOURCE = "assets/brand/logo-original.png"; // 1536×1024, fondo oscuro con brillo azul
const NAVY = { r: 6, g: 14, b: 31, alpha: 1 };

await mkdir("public/brand", { recursive: true });
await mkdir("public/icons", { recursive: true });

// Logo completo (engranaje + «RLS TOOLS»), sin el borde oscuro vacío
await sharp(SOURCE).extract({ left: 20, top: 250, width: 1500, height: 580 }).resize({ width: 720 }).png({ compressionLevel: 9, palette: true, quality: 92 }).toFile("public/brand/logo.png");

// Símbolo: el engranaje con la llave y el destornillador
const mark = await sharp(SOURCE).extract({ left: 40, top: 270, width: 560, height: 540 }).resize({ width: 512, height: 512, fit: "cover" }).png().toBuffer();
await sharp(mark).resize(256, 256).png({ compressionLevel: 9 }).toFile("public/brand/mark.png");

/** Ícono cuadrado: símbolo sobre azul marino. `scale` = cuánto del lienzo ocupa. */
async function icon(file, size, scale, radius = 0) {
  const inner = Math.round(size * scale);
  const logo = await sharp(mark).resize(inner, inner).toBuffer();
  let image = sharp({ create: { width: size, height: size, channels: 4, background: NAVY } }).composite([{ input: logo, gravity: "center" }]);
  if (radius) {
    const flat = await image.png().toBuffer();
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="#fff"/></svg>`);
    image = sharp(flat).composite([{ input: mask, blend: "dest-in" }]);
  }
  await image.png({ compressionLevel: 9 }).toFile(file);
}

await icon("public/icons/icon-192.png", 192, 0.92, 40);
await icon("public/icons/icon-512.png", 512, 0.92, 108);
// Maskable: Android recorta en círculo o «squircle»; el símbolo va dentro de la zona segura
await icon("public/icons/icon-maskable-512.png", 512, 0.72);
await icon("public/icons/apple-touch-icon.png", 180, 0.9);
await icon("src/app/icon.png", 64, 0.95, 14);
console.log("Marca de RLS Tools generada");
