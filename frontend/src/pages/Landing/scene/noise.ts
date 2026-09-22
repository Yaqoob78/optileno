/* Deterministic randomness + 2D gradient noise for building the landing world.
   Everything is seeded so the tree, terrain and forest look identical on every visit. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function grad(ix: number, iy: number, seed: number, x: number, y: number): number {
  const angle = hash2(ix, iy, seed) * Math.PI * 2;
  return Math.cos(angle) * x + Math.sin(angle) * y;
}

/** Gradient noise, roughly in [-0.7, 0.7]. */
export function perlin2(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = fade(xf);
  const v = fade(yf);
  const n00 = grad(xi, yi, seed, xf, yf);
  const n10 = grad(xi + 1, yi, seed, xf - 1, yf);
  const n01 = grad(xi, yi + 1, seed, xf, yf - 1);
  const n11 = grad(xi + 1, yi + 1, seed, xf - 1, yf - 1);
  return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
}

/** Fractal noise normalised to roughly [0, 1]. */
export function fbm2(x: number, y: number, octaves = 5, seed = 0): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * perlin2(x * freq, y * freq, seed + i * 17);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return 0.5 + (sum / norm) * 0.75;
}

/** Ridged multifractal in [0, 1] — sharp crests, soft valleys. Good for mountain ranges. */
export function ridged2(x: number, y: number, octaves = 5, seed = 0): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  let prev = 1;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(perlin2(x * freq, y * freq, seed + i * 31) * 1.4);
    n = Math.max(n, 0);
    n *= n;
    sum += n * amp * prev;
    norm += amp;
    prev = n;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
