// Usage: node prepare.mjs <folder with hero.png, problem.png, …> [--out ../../frontend/public/story]
// For each image: writes <name>.webp (max 2560 px wide) and <name>.depth.webp (Depth Anything V2, white = near).
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
  if ((meta.width ?? 0) < 2400) console.warn(`  ! ${f} is only ${meta.width}px wide; 2560+ looks sharp on large screens`);

  await sharp(src).resize({ width: 2560, withoutEnlargement: true }).webp({ quality: 84, effort: 6 }).toFile(join(out, `${name}.webp`));

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
