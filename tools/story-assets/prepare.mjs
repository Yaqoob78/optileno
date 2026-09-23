// Usage: node prepare.mjs <folder with hero.png, problem.png, …> [--out ../../frontend/public/story]
// For each image: writes <name>.webp (2048 px), <name>.sm.webp (1280 px, phones) and
// <name>.depth.webp (Depth Anything V2, white = near). Source art lives in design/story-source.
// First run downloads the depth model (~100 MB) into the local cache.
import { pipeline, RawImage } from '@huggingface/transformers';
import sharp from 'sharp';
import { mkdirSync, readdirSync } from 'node:fs';
import { join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const input = args[0];
const outFlag = args.indexOf('--out');
const out = resolve(outFlag > -1 ? args[outFlag + 1] : fileURLToPath(new URL('../../frontend/public/story', import.meta.url)));
if (!input) {
  console.error('Usage: node prepare.mjs <input-folder> [--out <story-folder>]');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

const files = readdirSync(input).filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !f.includes('.depth.'));
if (!files.length) {
  console.error('No images found in', input);
  process.exit(1);
}

const estimate = await pipeline('depth-estimation', 'onnx-community/depth-anything-v2-small', { dtype: 'fp32' });

for (const f of files) {
  const name = parse(f).name.toLowerCase();
  const src = join(input, f);
  const meta = await sharp(src).metadata();
  const ratio = (meta.width ?? 16) / (meta.height ?? 9);
  if (Math.abs(ratio - 16 / 9) > 0.03) console.warn(`  ! ${f} is ${meta.width}×${meta.height}; the stage expects 16:9`);
  if ((meta.width ?? 0) < 2048) console.warn(`  ! ${f} is only ${meta.width}px wide; it will be upscaled. 2560+ looks sharpest`);

  await sharp(src).resize({ width: 2048, kernel: 'lanczos3' }).sharpen({ sigma: 0.6, m1: 0.4, m2: 1.2 }).webp({ quality: 86, effort: 6 }).toFile(join(out, `${name}.webp`));
  await sharp(src).resize({ width: 1280, kernel: 'lanczos3' }).webp({ quality: 82, effort: 6 }).toFile(join(out, `${name}.sm.webp`));

  const { depth } = await estimate(await RawImage.read(src));
  await sharp(Buffer.from(depth.data), { raw: { width: depth.width, height: depth.height, channels: depth.channels } })
    .resize(1024, Math.round(1024 / ratio))
    .blur(1.2)
    .normalise()
    .webp({ quality: 82 })
    .toFile(join(out, `${name}.depth.webp`));
  console.log(`✓ ${name}`);
}
console.log(`\nDone. Files are in ${out}`);
