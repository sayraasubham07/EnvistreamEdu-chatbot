/**
 * Creates a circular (round) version of the chat-header logo:
 * center square-crops suulogo.webp and applies a circular alpha mask,
 * saving src/assets/img/suulogo-round.png with real transparency.
 *
 * Usage: node scripts/make-round-logo.mjs
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src/assets/img/suulogo.webp');
const out = path.join(root, 'src/assets/img/suulogo-round.png');

const { width, height } = await sharp(src).metadata();
const size = Math.min(width, height); // center square crop

const circle = Buffer.from(
  `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`
);

await sharp(src)
  .resize(size, size, { fit: 'cover', position: 'centre' })
  .composite([{ input: circle, blend: 'dest-in' }])
  .png({ compressionLevel: 9 })
  .toFile(out);

// Verify the mask: corners transparent, center opaque
const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
const a = (x, y) => data[(y * info.width + x) * 4 + 3];
console.log(`Round logo written: ${path.relative(root, out)} (${info.width}x${info.height})`);
console.log('corners alpha:', a(0, 0), a(info.width - 1, 0), a(0, info.height - 1), a(info.width - 1, info.height - 1));
console.log('center alpha:', a(Math.floor(info.width / 2), Math.floor(info.height / 2)));
