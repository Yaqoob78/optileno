import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, fbm2, mulberry32, perlin2, ridged2, smoothstep } from './noise';

/* ───────────────────────────── Shared ───────────────────────────── */

/** Uniform objects shared (by reference) across every custom material so a
    single write per frame re-lights the whole world. */
export interface SharedUniforms {
  uTime: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
  uSkyColor: { value: THREE.Color };
  uGroundColor: { value: THREE.Color };
  uZenith: { value: THREE.Color };
  uHorizon: { value: THREE.Color };
  uLanternColor: { value: THREE.Color };
  uGlow: { value: number };
  uSunGlow: { value: number };
  uWind: { value: number };
}

export function createSharedUniforms(): SharedUniforms {
  return {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 0.2, -1).normalize() },
    uSunColor: { value: new THREE.Color('#ffd9a0') },
    uSkyColor: { value: new THREE.Color('#cfe0d8') },
    uGroundColor: { value: new THREE.Color('#2d3a26') },
    uZenith: { value: new THREE.Color('#5d86a8') },
    uHorizon: { value: new THREE.Color('#f2d7a6') },
    uLanternColor: { value: new THREE.Color('#ffb85c') },
    uGlow: { value: 0.7 },
    uSunGlow: { value: 0.7 },
    uWind: { value: 1 },
  };
}

export type Quality = 'high' | 'low';

const GLSL_NOISE = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      s += a * vnoise(p);
      p = p * 2.02 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return s;
  }
`;

function fogUniforms() {
  return THREE.UniformsUtils.clone(THREE.UniformsLib.fog);
}

/* ───────────────────────────── Sky ───────────────────────────── */

export function buildSky(u: SharedUniforms): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: u.uZenith,
      uHorizon: u.uHorizon,
      uGroundColor: u.uGroundColor,
      uSunColor: u.uSunColor,
      uSunDir: u.uSunDir,
      uSunGlow: u.uSunGlow,
      uTime: u.uTime,
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uGroundColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uSunGlow;
      uniform float uTime;
      varying vec3 vDir;
      ${GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.62, max(h, 0.0)), 0.75));
        col = mix(col, uHorizon * 0.9, smoothstep(0.0, -0.08, h));
        float sd = max(dot(d, uSunDir), 0.0);

        // Soft drifting cloud banks, lit from the sun side
        if (h > 0.0) {
          vec2 cuv = d.xz / (h + 0.18) * 0.85 + vec2(uTime * 0.0035, uTime * 0.001);
          float c = fbm(cuv * 1.3);
          c = smoothstep(0.5, 0.86, c) * smoothstep(0.0, 0.22, h);
          vec3 cloudCol = mix(uHorizon * 1.04, uSunColor * 1.15, pow(sd, 5.0) * 0.85);
          col = mix(col, cloudCol, c * 0.5);
        }

        col += uSunColor * (pow(sd, 5.0) * 0.2 + pow(sd, 40.0) * 0.45) * uSunGlow;
        col += uSunColor * smoothstep(0.99955, 0.99985, sd) * 1.6;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), material);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
}

/* ───────────────────────────── Terrain ───────────────────────────── */

export const LAKE_Y = -30;

function riverX(z: number) {
  return 60 * Math.sin(z * 0.0042 + 0.9) + 22 * Math.sin(z * 0.011 + 2.0) - 30;
}

export function terrainHeight(x: number, z: number): number {
  const dx = Math.abs(x - riverX(z));
  const valley = smoothstep(55, 320, dx);
  const distance = clamp01((-z + 40) / 760);
  const r = ridged2(x * 0.0026, z * 0.0026, 5, 11);
  const bumps = fbm2(x * 0.012, z * 0.012, 3, 4) - 0.5;
  let h = -40 + valley * (26 + 185 * r * (0.5 + 0.95 * distance)) + bumps * 9;
  h += smoothstep(-480, -900, z) * 150 * ridged2(x * 0.0017 + 3.1, z * 0.0017, 4, 5);
  h += smoothstep(90, 260, z) * 70;
  return h;
}

export function buildTerrain(quality: Quality): THREE.Mesh {
  const width = 1900;
  const depth = 1250;
  const geo = new THREE.PlaneGeometry(width, depth, quality === 'high' ? 240 : 150, quality === 'high' ? 170 : 104);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -depth / 2 + 270);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  const normals = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const shore = new THREE.Color('#6d7c45');
  const meadow = new THREE.Color('#4c6a33');
  const forest = new THREE.Color('#2a4526');
  const deep = new THREE.Color('#1d3320');
  const rock = new THREE.Color('#5a6158');
  const ridge = new THREE.Color('#79806f');
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const slope = 1 - normals.getY(i);
    const n = fbm2(x * 0.02, z * 0.02, 3, 9);
    c.copy(shore).lerp(meadow, smoothstep(LAKE_Y + 1, LAKE_Y + 12, y));
    c.lerp(forest, smoothstep(-18, 25, y + (n - 0.5) * 40));
    c.lerp(deep, smoothstep(0.55, 0.8, n) * 0.6);
    c.lerp(rock, smoothstep(0.32, 0.62, slope) * 0.85);
    c.lerp(ridge, smoothstep(95, 190, y) * 0.7);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }),
  );
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

/* ───────────────────────────── Lake ───────────────────────────── */

export function buildLake(u: SharedUniforms): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...fogUniforms(),
      uZenith: u.uZenith,
      uHorizon: u.uHorizon,
      uSunColor: u.uSunColor,
      uSunDir: u.uSunDir,
      uTime: u.uTime,
      uDeep: { value: new THREE.Color('#0c1d1a') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform vec3 uDeep;
      uniform float uTime;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      ${GLSL_NOISE}
      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        vec2 p = vWorld.xz * 0.045;
        float n1 = vnoise(p + vec2(uTime * 0.06, uTime * 0.035));
        float n2 = vnoise(p * 2.7 - vec2(uTime * 0.05, -uTime * 0.02));
        vec3 N = normalize(vec3((n1 - 0.5) * 0.1 + (n2 - 0.5) * 0.05, 1.0, (n2 - 0.5) * 0.1));
        float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uHorizon, uZenith, clamp(R.y * 1.6, 0.0, 1.0));
        vec3 col = mix(uDeep, sky, 0.14 + 0.6 * fres);
        float sd = max(dot(R, uSunDir), 0.0);
        col += uSunColor * (pow(sd, 220.0) * 2.4 + pow(sd, 14.0) * 0.22);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    fog: true,
  });
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(2000, 1400, 1, 1), material);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(0, LAKE_Y, -420);
  return lake;
}

/* ───────────────────────────── Cliff plateau ───────────────────────────── */

export const PLATEAU = { x: 2, z: 8, radius: 30 };

/** Height of the grassy plateau top (tree stands at the origin on y≈0). */
export function plateauTop(x: number, z: number): number {
  const dx = x - PLATEAU.x;
  const dz = z - PLATEAU.z;
  const r = Math.sqrt(dx * dx + dz * dz) / PLATEAU.radius;
  const dome = (1 - r * r) * 0.9;
  return dome + (fbm2(x * 0.08, z * 0.08, 3, 21) - 0.5) * 1.1 - 0.6;
}

export function buildPlateau(quality: Quality, treeCanopyRadius: number): THREE.Mesh {
  const segA = quality === 'high' ? 128 : 80;
  const segV = quality === 'high' ? 44 : 30;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const grass = new THREE.Color('#4f6d31');
  const grassLight = new THREE.Color('#6f8b3c');
  const moss = new THREE.Color('#3d5128');
  const rock = new THREE.Color('#4a4740');
  const rockDark = new THREE.Color('#2c2b27');
  const c = new THREE.Color();
  const R = PLATEAU.radius;

  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    for (let i = 0; i <= segA; i++) {
      const a = (i / segA) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      // Periodic noise lookups keep the seam at a = 2π watertight
      const wobble = perlin2(ca * 2.2 + 7, sa * 2.2 + 3, 5) * 0.12 + perlin2(ca * 6, sa * 6, 8) * 0.04;
      let r: number;
      let y: number;
      if (v < 0.62) {
        const t = v / 0.62;
        r = t * R * (1 + wobble * t);
        const x = PLATEAU.x + ca * r;
        const z = PLATEAU.z + sa * r;
        y = plateauTop(x, z) - smoothstep(0.86, 1.0, t) * 1.6;
      } else {
        const t = (v - 0.62) / 0.38;
        const rimR = R * (1 + wobble);
        const rock1 = perlin2(ca * 5 + t * 3, sa * 5 - t * 4, 13) * 3.2;
        r = rimR + Math.sin(t * Math.PI * 0.5) * 7 + rock1 + t * t * 10;
        const rx = PLATEAU.x + ca * rimR;
        const rz = PLATEAU.z + sa * rimR;
        y = plateauTop(rx, rz) - 1.6 - Math.pow(t, 0.85) * 58 + perlin2(ca * 3, t * 6, 17) * 2.5;
      }
      const x = PLATEAU.x + ca * r;
      const z = PLATEAU.z + sa * r;
      positions.push(x, y, z);

      if (v < 0.62) {
        const n = fbm2(x * 0.1, z * 0.1, 3, 2);
        c.copy(grass).lerp(grassLight, smoothstep(0.45, 0.75, n));
        // Baked contact shadow under the canopy
        const dt = Math.sqrt(x * x + z * z) / treeCanopyRadius;
        const shade = 0.42 + 0.58 * smoothstep(0.15, 1.05, dt);
        c.multiplyScalar(shade);
        c.lerp(moss, smoothstep(0.88, 1, v / 0.62) * 0.7);
      } else {
        const t = (v - 0.62) / 0.38;
        const n = fbm2(x * 0.15, y * 0.15 + z * 0.05, 3, 7);
        c.copy(rock).lerp(rockDark, smoothstep(0.3, 0.7, n));
        c.lerp(moss, (1 - smoothstep(0, 0.35, t)) * 0.8 + smoothstep(0.6, 0.8, n) * 0.35);
      }
      colors.push(c.r, c.g, c.b);
    }
  }

  const row = segA + 1;
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segA; i++) {
      const a = j * row + i;
      const b = a + row;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }),
  );
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

/* ───────────────────────────── Hero tree ───────────────────────────── */

interface Segment {
  a: THREE.Vector3;
  b: THREE.Vector3;
  ra: number;
  rb: number;
}

export interface TreeBuild {
  group: THREE.Group;
  canopyCenter: THREE.Vector3;
  canopyRadius: number;
  lanterns: THREE.Vector3[];
  leafMaterial: THREE.ShaderMaterial;
}

function leafTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rng = mulberry32(77);
  ctx.clearRect(0, 0, size, size);
  for (let i = 0; i < 64; i++) {
    const ang = rng() * Math.PI * 2;
    const rad = Math.sqrt(rng()) * size * 0.3;
    const cx = size / 2 + Math.cos(ang) * rad;
    const cy = size / 2 + Math.sin(ang) * rad;
    const len = size * (0.1 + rng() * 0.09);
    const wid = len * (0.36 + rng() * 0.14);
    const rot = rng() * Math.PI * 2;
    const shade = Math.floor(150 + rng() * 105);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-len / 2, 0);
    ctx.quadraticCurveTo(0, -wid, len / 2, 0);
    ctx.quadraticCurveTo(0, wid, -len / 2, 0);
    ctx.closePath();
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function glowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

const LANTERN_COUNT = 34;

export function buildHeroTree(u: SharedUniforms, quality: Quality, glowTex: THREE.Texture, alphaToCoverage: boolean): TreeBuild {
  const rng = mulberry32(2026);
  const segments: Segment[] = [];
  const tips: THREE.Vector3[] = [];
  const anchors: { p: THREE.Vector3; depth: number }[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const MAX_DEPTH = quality === 'high' ? 5 : 4;

  const randomPerp = (d: THREE.Vector3) => {
    const t = Math.abs(d.y) < 0.9 ? up : new THREE.Vector3(1, 0, 0);
    const p = new THREE.Vector3().crossVectors(d, t).normalize();
    return p.applyAxisAngle(d, rng() * Math.PI * 2);
  };

  const grow = (start: THREE.Vector3, dir: THREE.Vector3, len: number, r: number, depth: number) => {
    let p = start.clone();
    const d = dir.clone();
    const steps = 3;
    const joints: THREE.Vector3[] = [];
    for (let k = 0; k < steps; k++) {
      d.x += (rng() - 0.5) * 0.35;
      d.z += (rng() - 0.5) * 0.35;
      d.y += (rng() - 0.5) * 0.2 + (depth >= 3 ? -0.05 : 0.04);
      d.normalize();
      const next = p.clone().addScaledVector(d, len / steps);
      const r0 = r * (1 - (k / steps) * 0.3);
      const r1 = r * (1 - ((k + 1) / steps) * 0.3);
      segments.push({ a: p.clone(), b: next.clone(), ra: r0, rb: r1 });
      if (depth >= 2 && depth <= 4 && Math.abs(d.y) < 0.62) {
        anchors.push({ p: p.clone().lerp(next, rng()), depth });
      }
      p = next;
      joints.push(next.clone());
    }

    if (depth >= MAX_DEPTH) {
      tips.push(p.clone());
      return;
    }
    if (depth >= MAX_DEPTH - 1) tips.push(p.clone());

    const children = depth === 0 ? 0 : depth < 3 ? 3 : 2 + (rng() < 0.4 ? 1 : 0);
    for (let c = 0; c < children; c++) {
      const axis = randomPerp(d);
      const angle = (0.45 + rng() * 0.45) * (depth < 2 ? 0.9 : 1.1);
      const childDir = d.clone().applyAxisAngle(axis, angle);
      // Keep the crown broad and domed, like an old oak
      childDir.y = childDir.y * 0.75 + 0.12;
      childDir.normalize();
      // First child continues from the tip; the rest sprout further down this branch
      const at = c === 0 ? p : joints[Math.floor(rng() * (steps - 1))];
      grow(at, childDir, len * (0.7 + rng() * 0.12), r * 0.6, depth + 1);
    }
  };

  // Trunk with a gentle S-curve
  const trunkTop = new THREE.Vector3(0.3, 5.6, -0.2);
  const trunkPts = [
    new THREE.Vector3(0, -1.2, 0),
    new THREE.Vector3(0.25, 1.6, 0.1),
    new THREE.Vector3(-0.1, 3.8, -0.1),
    trunkTop,
  ];
  const trunkR = [1.75, 1.3, 1.12, 1.0];
  for (let i = 0; i < trunkPts.length - 1; i++) {
    segments.push({ a: trunkPts[i], b: trunkPts[i + 1], ra: trunkR[i], rb: trunkR[i + 1] });
  }

  // Main limbs radiate from the crown of the trunk
  const limbCount = 6;
  for (let i = 0; i < limbCount; i++) {
    const az = (i / limbCount) * Math.PI * 2 + rng() * 0.5;
    const tilt = 0.55 + rng() * 0.35;
    const dir = new THREE.Vector3(Math.cos(az) * Math.sin(tilt), Math.cos(tilt), Math.sin(az) * Math.sin(tilt)).normalize();
    const start = trunkPts[2].clone().lerp(trunkTop, 0.3 + rng() * 0.7);
    grow(start, dir, 6.2 + rng() * 2.2, 0.72, 1);
  }
  // A central leader for height
  grow(trunkTop, new THREE.Vector3(0.05, 1, 0.02).normalize(), 5.5, 0.6, 2);

  // Surface roots
  for (let i = 0; i < 7; i++) {
    const az = (i / 7) * Math.PI * 2 + rng() * 0.4;
    const dir = new THREE.Vector3(Math.cos(az), -0.28, Math.sin(az)).normalize();
    const start = new THREE.Vector3(Math.cos(az) * 0.8, 0.9, Math.sin(az) * 0.8);
    const end = start.clone().addScaledVector(dir, 3.2 + rng() * 1.6);
    segments.push({ a: start, b: end, ra: 0.7, rb: 0.12 });
  }

  /* Bark geometry */
  const pieces: THREE.BufferGeometry[] = [];
  const yAxis = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  for (const s of segments) {
    const dir = new THREE.Vector3().subVectors(s.b, s.a);
    const len = dir.length();
    if (len < 1e-4) continue;
    dir.normalize();
    const radial = s.ra > 0.5 ? 12 : s.ra > 0.15 ? 7 : 5;
    const g = new THREE.CylinderGeometry(s.rb, s.ra, len + s.ra * 0.4, radial, 1, true);
    q.setFromUnitVectors(yAxis, dir);
    g.applyQuaternion(q);
    const mid = s.a.clone().add(s.b).multiplyScalar(0.5);
    g.translate(mid.x, mid.y, mid.z);
    pieces.push(g);
    if (s.ra > 0.35) {
      const joint = new THREE.SphereGeometry(s.rb * 1.02, radial, 5);
      joint.translate(s.b.x, s.b.y, s.b.z);
      pieces.push(joint);
    }
  }
  const barkGeo = mergeGeometries(pieces, false)!;
  pieces.forEach((g) => g.dispose());
  const bark = new THREE.Mesh(
    barkGeo,
    new THREE.MeshStandardMaterial({ color: '#3a2c21', roughness: 0.95, metalness: 0 }),
  );

  /* Canopy volume */
  const bbox = new THREE.Box3().setFromPoints(tips);
  const canopyCenter = bbox.getCenter(new THREE.Vector3());
  const canopySize = bbox.getSize(new THREE.Vector3());
  const canopyRadius = Math.max(canopySize.x, canopySize.z) * 0.5 + 2;

  /* Leaves */
  const leafTotal = quality === 'high' ? 11000 : 5200;
  const perTip = Math.max(6, Math.floor(leafTotal / tips.length));
  const count = perTip * tips.length;
  const leafGeo = new THREE.PlaneGeometry(1, 1);
  const tex = leafTexture();
  const lanternUniform = { value: [] as THREE.Vector3[] };

  const leafMaterial = new THREE.ShaderMaterial({
    uniforms: {
      ...fogUniforms(),
      uMap: { value: tex },
      uTime: u.uTime,
      uWind: u.uWind,
      uSunDir: u.uSunDir,
      uSunColor: u.uSunColor,
      uSkyColor: u.uSkyColor,
      uGroundColor: u.uGroundColor,
      uLanternColor: u.uLanternColor,
      uGlow: u.uGlow,
      uLanterns: lanternUniform,
    },
    defines: alphaToCoverage ? { LANTERN_COUNT, USE_A2C: 1 } : { LANTERN_COUNT },
    vertexShader: /* glsl */ `
      attribute vec3 aLeafNormal;
      attribute float aAO;
      uniform float uTime;
      uniform float uWind;
      uniform float uGlow;
      uniform vec3 uLanterns[LANTERN_COUNT];
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorld;
      varying vec3 vColor;
      varying float vWarm;
      varying float vAO;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec3 origin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        float sway = sin(uTime * 1.05 + origin.x * 0.33 + origin.z * 0.21) * 0.6
                   + sin(uTime * 2.4 + origin.y * 0.9 + origin.x) * 0.3;
        world.xyz += vec3(0.11, 0.035, 0.07) * sway * uWind * (0.6 + position.y);
        vWorld = world.xyz;
        vNormal = aLeafNormal;
        vColor = instanceColor;
        vAO = aAO;
        float warm = 0.0;
        for (int i = 0; i < LANTERN_COUNT; i++) {
          vec3 d = uLanterns[i] - origin;
          warm += 1.0 / (1.0 + dot(d, d) * 2.2);
        }
        vWarm = min(warm, 1.2) * uGlow;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyColor;
      uniform vec3 uGroundColor;
      uniform vec3 uLanternColor;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vWorld;
      varying vec3 vColor;
      varying float vWarm;
      varying float vAO;
      #include <fog_pars_fragment>
      void main() {
        vec4 tex = texture2D(uMap, vUv);
        #ifdef USE_A2C
          // Sharpened alpha-to-coverage: crisp, non-shimmering leaf edges under MSAA
          float alpha = clamp((tex.a - 0.5) / max(fwidth(tex.a), 1e-4) + 0.5, 0.0, 1.0);
          if (alpha < 0.01) discard;
        #else
          float alpha = 1.0;
          if (tex.a < 0.5) discard;
        #endif
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorld);
        float wrap = clamp((dot(N, uSunDir) + 0.5) / 1.5, 0.0, 1.0);
        vec3 hemi = mix(uGroundColor, uSkyColor, N.y * 0.5 + 0.5);
        vec3 base = vColor * (0.62 + 0.45 * tex.r);
        vec3 col = base * (hemi * 0.72 + uSunColor * wrap * wrap * 0.95) * vAO;
        // Sun glowing through the outer leaves when backlit
        float trans = pow(clamp(dot(-V, uSunDir), 0.0, 1.0), 6.0);
        float edge = smoothstep(0.62, 1.0, vAO);
        col += base * uSunColor * trans * (1.0 - wrap * 0.6) * 0.75 * edge;
        col += uLanternColor * vWarm * 0.16 * (0.5 + 0.5 * tex.r);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    side: THREE.DoubleSide,
    fog: true,
    alphaToCoverage,
  });

  const leaves = new THREE.InstancedMesh(leafGeo, leafMaterial, count);
  const leafNormals = new Float32Array(count * 3);
  const leafAO = new Float32Array(count);
  const m = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scl = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const col = new THREE.Color();
  const palette = ['#264a1e', '#2e5723', '#376229', '#41702f', '#1f3f1a', '#4c7a34'].map((h) => new THREE.Color(h));
  const radii = new THREE.Vector3(canopyRadius, canopySize.y * 0.5 + 2, canopyRadius);

  let idx = 0;
  for (const tip of tips) {
    const outward = tip.clone().sub(canopyCenter).normalize();
    for (let k = 0; k < perTip; k++) {
      const offset = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(0.2 + rng() * 1.5);
      offset.addScaledVector(outward, 0.5);
      offset.y += 0.35;
      pos.copy(tip).add(offset);
      euler.set(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2);
      quat.setFromEuler(euler);
      const s = 1.25 + rng() * 0.75;
      scl.set(s, s, s);
      m.compose(pos, quat, scl);
      leaves.setMatrixAt(idx, m);

      const rel = pos.clone().sub(canopyCenter).divide(radii);
      const dist = rel.length();
      const n = rel.clone().normalize().multiplyScalar(0.75).add(offset.clone().normalize().multiplyScalar(0.25)).normalize();
      leafNormals.set([n.x, n.y, n.z], idx * 3);
      leafAO[idx] = 0.42 + 0.58 * smoothstep(0.2, 1.0, dist) * (0.75 + 0.25 * clamp01(rel.y + 0.6));

      col.copy(palette[Math.floor(rng() * palette.length)]);
      col.offsetHSL((rng() - 0.5) * 0.03, (rng() - 0.5) * 0.08, (rng() - 0.5) * 0.05 + clamp01(rel.y) * 0.04);
      leaves.setColorAt(idx, col);
      idx++;
    }
  }
  leaves.geometry.setAttribute('aLeafNormal', new THREE.InstancedBufferAttribute(leafNormals, 3));
  leaves.geometry.setAttribute('aAO', new THREE.InstancedBufferAttribute(leafAO, 1));
  leaves.instanceMatrix.needsUpdate = true;
  leaves.computeBoundingSphere();

  /* Lanterns: glowing fruit-like orbs hanging from the outer limbs */
  const outer = anchors
    .filter((a) => {
      const dx = a.p.x - canopyCenter.x;
      const dz = a.p.z - canopyCenter.z;
      return Math.sqrt(dx * dx + dz * dz) > canopyRadius * 0.38 && a.p.y < canopyCenter.y + 1.5;
    })
    .sort(() => rng() - 0.5);
  const lanternPts: THREE.Vector3[] = [];
  const stringPts: number[] = [];
  for (const a of outer) {
    if (lanternPts.length >= LANTERN_COUNT) break;
    const drop = 0.7 + rng() * 1.5;
    const p = a.p.clone().add(new THREE.Vector3(0, -drop, 0));
    if (lanternPts.some((o) => o.distanceTo(p) < 1.6)) continue;
    lanternPts.push(p);
    stringPts.push(a.p.x, a.p.y, a.p.z, p.x, p.y + 0.18, p.z);
  }
  while (lanternPts.length < LANTERN_COUNT) {
    lanternPts.push(new THREE.Vector3(0, -100, 0));
  }
  lanternUniform.value = lanternPts;

  const lanternGeo = new THREE.SphereGeometry(1, 16, 12);
  // Paper-lantern orbs: hot white core, amber rim; dim and papery by day
  const lanternMat = new THREE.ShaderMaterial({
    uniforms: { uColor: u.uLanternColor, uGlow: u.uGlow },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        vV = normalize(cameraPosition - world.xyz);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uGlow;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float ndv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        vec3 lit = mix(uColor * 1.1, vec3(1.0, 0.93, 0.76) * 1.5, pow(ndv, 2.2));
        vec3 unlit = vec3(0.46, 0.36, 0.24) * (0.55 + 0.45 * ndv);
        gl_FragColor = vec4(mix(unlit, lit, clamp(uGlow * 1.25, 0.0, 1.0)), 1.0);
        #include <colorspace_fragment>
      }
    `,
    toneMapped: false,
  });
  const bodies = new THREE.InstancedMesh(lanternGeo, lanternMat, LANTERN_COUNT);
  lanternPts.forEach((p, i) => {
    const r = 0.17 + rng() * 0.1;
    m.compose(p, quat.identity(), scl.set(r, r * 1.15, r));
    bodies.setMatrixAt(i, m);
  });
  bodies.instanceMatrix.needsUpdate = true;
  bodies.computeBoundingSphere();

  const strings = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(stringPts, 3)),
    new THREE.LineBasicMaterial({ color: '#1f1a14', transparent: true, opacity: 0.55 }),
  );

  // Halo sprites (a Points cloud keeps it to one draw call)
  const haloPositions = new Float32Array(LANTERN_COUNT * 3);
  const haloSeeds = new Float32Array(LANTERN_COUNT);
  lanternPts.forEach((p, i) => {
    haloPositions.set([p.x, p.y, p.z], i * 3);
    haloSeeds[i] = rng() * 100;
  });
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPositions, 3));
  haloGeo.setAttribute('aSeed', new THREE.BufferAttribute(haloSeeds, 1));
  const halos = new THREE.Points(
    haloGeo,
    new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: glowTex },
        uTime: u.uTime,
        uGlow: u.uGlow,
        uColor: u.uLanternColor,
        uScale: { value: 1 },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform float uGlow;
        uniform float uScale;
        varying float vFlicker;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vFlicker = 0.82 + 0.18 * sin(uTime * 2.1 + aSeed) * sin(uTime * 3.7 + aSeed * 1.3);
          gl_PointSize = uScale * (1.1 + uGlow * 1.3) * 300.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uColor;
        uniform float uGlow;
        varying float vFlicker;
        void main() {
          float a = texture2D(uMap, gl_PointCoord).a;
          gl_FragColor = vec4(uColor * a * (0.2 + uGlow * 0.95) * vFlicker, 1.0);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  halos.renderOrder = 5;
  halos.userData.isHalo = true;

  const group = new THREE.Group();
  group.add(bark, leaves, bodies, strings, halos);
  return { group, canopyCenter, canopyRadius, lanterns: lanternPts, leafMaterial };
}

/* ───────────────────────────── Grass ───────────────────────────── */

export function buildGrass(u: SharedUniforms, quality: Quality): THREE.InstancedMesh {
  const count = quality === 'high' ? 16000 : 6000;
  const rng = mulberry32(99);
  // Tapered blade, 4 segments tall
  const blade = new THREE.BufferGeometry();
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const SEG = 4;
  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    const w = 0.07 * (1 - t) + 0.004;
    verts.push(-w, t, 0, w, t, 0);
    uvs.push(0, t, 1, t);
    if (i < SEG) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  blade.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  blade.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  blade.setIndex(idx);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...fogUniforms(),
      uTime: u.uTime,
      uWind: u.uWind,
      uSunDir: u.uSunDir,
      uSunColor: u.uSunColor,
      uSkyColor: u.uSkyColor,
      uGroundColor: u.uGroundColor,
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWind;
      varying float vT;
      varying vec3 vColor;
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vT = uv.y;
        vColor = instanceColor;
        vec3 origin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
        float gust = sin(uTime * 1.3 + origin.x * 0.18 + origin.z * 0.12) * 0.5 + 0.5;
        float bend = uv.y * uv.y * (0.18 + gust * 0.32) * uWind;
        world.x += bend * 0.9;
        world.z += bend * 0.35 * sin(uTime * 0.9 + origin.x);
        world.y -= bend * 0.25;
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyColor;
      uniform vec3 uGroundColor;
      varying float vT;
      varying vec3 vColor;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 base = vColor * mix(0.35, 1.05, vT);
        vec3 col = base * (mix(uGroundColor, uSkyColor, 0.6) * 0.8 + uSunColor * 0.45 * max(uSunDir.y + 0.35, 0.0));
        float trans = pow(clamp(dot(-V, uSunDir), 0.0, 1.0), 5.0) * vT;
        col += base * uSunColor * trans * 1.2;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    side: THREE.DoubleSide,
    fog: true,
  });

  const mesh = new THREE.InstancedMesh(blade, material, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  const greens = ['#4e7a2c', '#5f8c33', '#3e6624', '#76963e', '#6a8a36'].map((h) => new THREE.Color(h));
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * PLATEAU.radius * 0.9;
    const x = PLATEAU.x + Math.cos(a) * r;
    const z = PLATEAU.z + Math.sin(a) * r;
    const trunkDist = Math.sqrt(x * x + z * z);
    if (trunkDist < 1.8) {
      i--;
      continue;
    }
    p.set(x, plateauTop(x, z) - 0.05, z);
    e.set((rng() - 0.5) * 0.35, rng() * Math.PI, (rng() - 0.5) * 0.35);
    q.setFromEuler(e);
    const clump = fbm2(x * 0.15, z * 0.15, 2, 3);
    const h = (0.45 + rng() * 0.75) * (0.6 + clump * 0.9);
    s.set(1 + rng() * 0.6, h, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    c.copy(greens[Math.floor(rng() * greens.length)]).offsetHSL(0, 0, (rng() - 0.5) * 0.06);
    // Shade blades that sit under the canopy
    c.multiplyScalar(0.55 + 0.45 * smoothstep(3, 14, trunkDist));
    mesh.setColorAt(i, c);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/* ───────────────────────────── Distant forest ───────────────────────────── */

export function buildForest(quality: Quality): THREE.Group {
  const rng = mulberry32(314);
  const conifers = quality === 'high' ? 2600 : 1100;
  const broadleaf = quality === 'high' ? 1700 : 700;

  const coneGeo = mergeGeometries([
    new THREE.ConeGeometry(2.4, 7, 7).translate(0, 5.5, 0),
    new THREE.ConeGeometry(1.8, 5.5, 7).translate(0, 8.6, 0),
    new THREE.CylinderGeometry(0.35, 0.45, 3, 5).translate(0, 1.5, 0),
  ])!;
  const roundGeo = mergeGeometries([
    new THREE.IcosahedronGeometry(3, 1).scale(1, 0.85, 1).translate(0, 5.2, 0),
    new THREE.CylinderGeometry(0.35, 0.5, 3.4, 5).translate(0, 1.7, 0).toNonIndexed(),
  ])!;

  const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, flatShading: true });
  const coneMesh = new THREE.InstancedMesh(coneGeo, mat, conifers);
  const roundMesh = new THREE.InstancedMesh(roundGeo, mat, broadleaf);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  const c = new THREE.Color();
  const pine = ['#1f3b22', '#264527', '#2d4f2a', '#1a3320'].map((h) => new THREE.Color(h));
  const leafy = ['#35582a', '#416530', '#2f5026', '#4d6f33'].map((h) => new THREE.Color(h));

  const place = (mesh: THREE.InstancedMesh, total: number, colors: THREE.Color[], sizeMin: number, sizeRange: number) => {
    let placed = 0;
    let guard = 0;
    while (placed < total && guard < total * 40) {
      guard++;
      const x = (rng() - 0.5) * 1100;
      const z = 120 - rng() * 780;
      const dxp = x - PLATEAU.x;
      const dzp = z - PLATEAU.z;
      if (dxp * dxp + dzp * dzp < (PLATEAU.radius + 16) ** 2) continue;
      const h = terrainHeight(x, z);
      if (h < LAKE_Y + 1.2 || h > 115) continue;
      const slope = Math.abs(terrainHeight(x + 3, z) - h) + Math.abs(terrainHeight(x, z + 3) - h);
      if (slope > 5.5) continue;
      const density = fbm2(x * 0.012, z * 0.012, 3, 42);
      if (rng() > smoothstep(0.38, 0.62, density)) continue;
      const size = sizeMin + rng() * sizeRange;
      p.set(x, h - 0.6, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
      s.set(size, size * (0.85 + rng() * 0.4), size);
      m.compose(p, q, s);
      mesh.setMatrixAt(placed, m);
      c.copy(colors[Math.floor(rng() * colors.length)]).offsetHSL(0, (rng() - 0.5) * 0.08, (rng() - 0.5) * 0.04);
      mesh.setColorAt(placed, c);
      placed++;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  };

  place(coneMesh, conifers, pine, 0.9, 1.1);
  place(roundMesh, broadleaf, leafy, 0.8, 0.9);

  const group = new THREE.Group();
  group.add(coneMesh, roundMesh);
  return group;
}

/* ───────────────────────────── Fireflies & pollen ───────────────────────────── */

export function buildFireflies(u: SharedUniforms, quality: Quality, glowTex: THREE.Texture): THREE.Points {
  const count = quality === 'high' ? 260 : 130;
  const rng = mulberry32(8);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = 3 + Math.sqrt(rng()) * 34;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = 0.5 + rng() * 17;
    positions[i * 3 + 2] = Math.sin(a) * r + 4;
    seeds[i] = rng() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: u.uTime,
      uGlow: u.uGlow,
      uMap: { value: glowTex },
      uColor: { value: new THREE.Color('#ffe7a8') },
      uScale: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uScale;
      varying float vTwinkle;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.21 + aSeed) * 1.6 + sin(uTime * 0.53 + aSeed * 2.1) * 0.5;
        p.y += sin(uTime * 0.31 + aSeed * 1.7) * 0.9;
        p.z += cos(uTime * 0.19 + aSeed * 0.6) * 1.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vTwinkle = pow(0.5 + 0.5 * sin(uTime * (0.9 + fract(aSeed) * 1.4) + aSeed * 7.0), 2.0);
        gl_PointSize = uScale * (0.16 + fract(aSeed * 3.1) * 0.18) * 300.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      uniform float uGlow;
      varying float vTwinkle;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a;
        gl_FragColor = vec4(uColor * a * vTwinkle * (0.08 + uGlow * 0.85), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  points.renderOrder = 6;
  return points;
}

/* ───────────────────────────── Light shafts (screen-space) ───────────────────────────── */

export function buildLightShafts(u: SharedUniforms): { mesh: THREE.Mesh; sunScreen: THREE.Vector2; strength: { value: number }; aspect: { value: number } } {
  const sunScreen = new THREE.Vector2(0.5, 0.5);
  const strength = { value: 0.6 };
  const aspect = { value: 1 };
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: sunScreen },
      uStrength: strength,
      uAspect: aspect,
      uColor: u.uSunColor,
      uTime: u.uTime,
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uSun;
      uniform float uStrength;
      uniform float uAspect;
      uniform vec3 uColor;
      uniform float uTime;
      varying vec2 vUv;
      ${GLSL_NOISE}
      void main() {
        vec2 d = vUv - uSun;
        d.x *= uAspect;
        float r = length(d);
        float ang = atan(d.y, d.x);
        float rays = vnoise(vec2(ang * 7.0, uTime * 0.05)) * 0.6 + vnoise(vec2(ang * 17.0 + 3.0, uTime * 0.08)) * 0.4;
        rays = pow(smoothstep(0.35, 1.0, rays), 1.6);
        float fall = exp(-r * 1.9);
        float bloom = exp(-r * 7.0) * 0.55 + exp(-r * 2.6) * 0.18;
        vec3 col = uColor * (rays * fall * 0.55 + bloom) * uStrength;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  return { mesh, sunScreen, strength, aspect };
}
