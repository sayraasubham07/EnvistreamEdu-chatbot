/**
 * Removes the near-uniform light-gray studio background from the Sayraa mascot
 * images and saves them as transparent PNGs in src/assets/img/.
 *
 * Technique: flood-fill the background from the image borders (so white parts
 * of the character like the ID badge are never touched), also absorb the soft
 * neutral-gray ground shadow, feather the alpha edge, and trim to content.
 *
 * Usage: node scripts/remove-bg.mjs
 */
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const jobs = [
  { in: 'C:/Users/Asus/Downloads/1000426602.png', out: 'src/assets/img/suu-trainee-1.png' },
  { in: 'C:/Users/Asus/Downloads/1000426605.png', out: 'src/assets/img/suu-trainee-2.png' },
  { in: 'C:/Users/Asus/Downloads/1000426607.png', out: 'src/assets/img/suu-trainee-3.png' },
];

const DIST_TOL = 26;        // color distance from bg still considered background
const SHADOW_LUM_MIN = 100; // ground shadow is a darker neutral gray
const FEATHER_RADIUS = 2;   // box blur passes for soft alpha edges
const TRIM_MARGIN = 6;      // px padding kept around the subject

async function removeBackground(inputPath, outputPath) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const size = w * h;

  const idxOf = (x, y) => (y * w + x) * ch;
  const at = (x, y) => {
    const i = idxOf(x, y);
    return [data[i], data[i + 1], data[i + 2]];
  };

  // Sample the background color from the four corners
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)];
  const bg = [0, 1, 2].map((c) => corners.reduce((s, cc) => s + cc[c], 0) / 4);
  const bgLum = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2];

  const isBackground = (x, y) => {
    const i = idxOf(x, y);
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = Math.sqrt((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2);
    if (dist < DIST_TOL) return true;
    // Soft ground shadow: neutral (low saturation) gray, darker than the bg
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return max - min <= 12 && lum <= bgLum + 2 && lum >= SHADOW_LUM_MIN;
  };

  // Flood fill background from every border pixel
  const mask = new Uint8Array(size); // 255 = background
  const queue = new Int32Array(size);
  let qStart = 0, qEnd = 0;
  const push = (idx) => {
    if (!mask[idx]) {
      mask[idx] = 255;
      queue[qEnd++] = idx;
    }
  };
  for (let x = 0; x < w; x++) {
    if (isBackground(x, 0)) push(x);
    if (isBackground(x, h - 1)) push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    if (isBackground(0, y)) push(y * w);
    if (isBackground(w - 1, y)) push(y * w + w - 1);
  }
  while (qStart < qEnd) {
    const idx = queue[qStart++];
    const x = idx % w;
    const y = (idx - x) / w;
    if (x > 0 && isBackground(x - 1, y)) push(idx - 1);
    if (x < w - 1 && isBackground(x + 1, y)) push(idx + 1);
    if (y > 0 && isBackground(x, y - 1)) push(idx - w);
    if (y < h - 1 && isBackground(x, y + 1)) push(idx + w);
  }

  // Start fully opaque, then make flooded region transparent
  const alpha = new Uint8ClampedArray(size).fill(255);
  for (let i = 0; i < size; i++) if (mask[i]) alpha[i] = 0;

  // Keep only the largest opaque connected component (the character) so any
  // leftover background/shadow blobs floating near the subject are removed
  {
    const comp = new Int32Array(size).fill(-1);
    const compQueue = new Int32Array(size);
    let compCount = 0, bestComp = -1, bestSize = 0;
    for (let start = 0; start < size; start++) {
      if (alpha[start] <= 8 || comp[start] !== -1) continue;
      let qs = 0, qe = 0, cSize = 0;
      comp[start] = compCount;
      compQueue[qe++] = start;
      while (qs < qe) {
        const idx = compQueue[qs++];
        cSize++;
        const x = idx % w;
        const y = (idx - x) / w;
        const neighbours = [];
        if (x > 0) neighbours.push(idx - 1);
        if (x < w - 1) neighbours.push(idx + 1);
        if (y > 0) neighbours.push(idx - w);
        if (y < h - 1) neighbours.push(idx + w);
        for (const n of neighbours) {
          if (alpha[n] > 8 && comp[n] === -1) {
            comp[n] = compCount;
            compQueue[qe++] = n;
          }
        }
      }
      if (cSize > bestSize) { bestSize = cSize; bestComp = compCount; }
      compCount++;
    }
    for (let i = 0; i < size; i++) {
      if (alpha[i] > 8 && comp[i] !== bestComp) alpha[i] = 0;
    }
    console.log(`    components: ${compCount}, kept #${bestComp} (${bestSize} px)`);
  }

  // Feather the alpha edge with a few box blur passes (only shrinks/blurs
  // within a couple of pixels, keeping interior fully opaque)
  const tmp = new Uint8ClampedArray(size);
  for (let pass = 0; pass < FEATHER_RADIUS; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            sum += alpha[yy * w + xx];
            n++;
          }
        }
        tmp[y * w + x] = sum / n;
      }
    }
    alpha.set(tmp);
  }

  // Write alpha back into the RGBA buffer
  for (let i = 0; i < size; i++) data[i * ch + 3] = alpha[i];

  // Find the content bounding box (where alpha is visible)
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  minX = Math.max(0, minX - TRIM_MARGIN);
  minY = Math.max(0, minY - TRIM_MARGIN);
  maxX = Math.min(w - 1, maxX + TRIM_MARGIN);
  maxY = Math.min(h - 1, maxY + TRIM_MARGIN);
  const cw = maxX - minX + 1;
  const chh = maxY - minY + 1;

  // Crop to the bounding box
  const cropped = Buffer.alloc(cw * chh * ch);
  for (let y = 0; y < chh; y++) {
    const srcStart = ((minY + y) * w + minX) * ch;
    data.copy(cropped, y * cw * ch, srcStart, srcStart + cw * ch);
  }

  await sharp(cropped, { raw: { width: cw, height: chh, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outputPath);

  console.log(`OK  ${path.basename(inputPath)} -> ${path.relative(root, outputPath)} (${cw}x${chh})`);
}

const outDir = path.join(root, 'src/assets/img');
fs.mkdirSync(outDir, { recursive: true });

for (const job of jobs) {
  await removeBackground(job.in, path.join(root, job.out));
}
console.log('Done.');
