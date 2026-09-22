import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

/* Atmosphere for the Glass Week: sky, lake, far ridges, mist and dust. */

export interface SharedUniforms {
  uTime: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
  uZenith: { value: THREE.Color };
  uHorizon: { value: THREE.Color };
  uSunGlow: { value: number };
  uMist: { value: THREE.Color };
}

export function createUniforms(): SharedUniforms {
  return {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0, 0.1, -1).normalize() },
    uSunColor: { value: new THREE.Color('#ffd2a0') },
    uZenith: { value: new THREE.Color('#7f97ab') },
    uHorizon: { value: new THREE.Color('#efd9b8') },
    uSunGlow: { value: 0.8 },
    uMist: { value: new THREE.Color('#e9e2d2') },
  };
}

export const GLSL_NOISE = /* glsl */ `
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
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return s;
  }
`;

/* ─── Sky ─── */

export function buildSky(u: SharedUniforms): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: u.uZenith,
      uHorizon: u.uHorizon,
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
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uSunGlow;
      uniform float uTime;
      varying vec3 vDir;
      ${GLSL_NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.02, 0.6, h), 0.7));
        float sd = max(dot(d, uSunDir), 0.0);
        if (h > 0.0) {
          vec2 cuv = d.xz / (h + 0.2) * 0.7 + vec2(uTime * 0.004, uTime * 0.0015);
          float c = smoothstep(0.52, 0.88, fbm(cuv * 1.2)) * smoothstep(0.0, 0.3, h);
          vec3 cloud = mix(uHorizon * 1.03, uSunColor * 1.1, pow(sd, 4.0) * 0.8);
          col = mix(col, cloud, c * 0.45);
        }
        col += uSunColor * (pow(sd, 4.0) * 0.18 + pow(sd, 32.0) * 0.4) * uSunGlow;
        col += uSunColor * smoothstep(0.9993, 0.9998, sd) * 1.4;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), material);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}

/* ─── Lake ─── */

export function buildMirrorLake(u: SharedUniforms, resolution: number): Reflector {
  const lake = new Reflector(new THREE.PlaneGeometry(420, 420), {
    textureWidth: resolution,
    textureHeight: resolution,
    clipBias: 0.002,
    multisample: 0,
    shader: {
      name: 'LakeShader',
      uniforms: {
        color: { value: new THREE.Color('#ffffff') },
        tDiffuse: { value: null },
        textureMatrix: { value: null },
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color('#12261f') },
        uHorizon: { value: new THREE.Color('#efd9b8') },
      },
      vertexShader: /* glsl */ `
        uniform mat4 textureMatrix;
        varying vec4 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = textureMatrix * vec4(position, 1.0);
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform vec3 uDeep;
        uniform vec3 uHorizon;
        varying vec4 vUv;
        varying vec3 vWorld;
        ${GLSL_NOISE}
        void main() {
          vec2 p = vWorld.xz;
          vec2 ripple = vec2(
            vnoise(p * 0.9 + vec2(uTime * 0.12, uTime * 0.05)) - 0.5,
            vnoise(p * 1.3 - vec2(uTime * 0.08, -uTime * 0.1)) - 0.5
          ) * 0.011;
          ripple += vec2(vnoise(p * 6.0 + uTime * 0.4) - 0.5) * 0.0015;
          vec4 uv = vUv;
          uv.xy += ripple * uv.w;
          vec3 refl = texture2DProj(tDiffuse, uv).rgb;
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = 0.28 + 0.72 * pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
          vec3 col = mix(uDeep, refl, fres);
          float dist = length(vWorld.xz - cameraPosition.xz);
          col = mix(col, uHorizon, smoothstep(60.0, 190.0, dist));
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    },
  });
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(0, 0, -60);
  const mat = lake.material as THREE.ShaderMaterial;
  mat.uniforms.uTime = u.uTime;
  mat.uniforms.uHorizon = u.uHorizon;
  return lake;
}

/** Cheaper lake for phones: reflects the sky gradient, not the scene. */
export function buildSimpleLake(u: SharedUniforms): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: u.uTime,
      uZenith: u.uZenith,
      uHorizon: u.uHorizon,
      uSunColor: u.uSunColor,
      uSunDir: u.uSunDir,
      uDeep: { value: new THREE.Color('#12261f') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform vec3 uDeep;
      varying vec3 vWorld;
      ${GLSL_NOISE}
      void main() {
        vec3 V = normalize(cameraPosition - vWorld);
        vec2 p = vWorld.xz * 0.6;
        vec3 N = normalize(vec3((vnoise(p + uTime * 0.1) - 0.5) * 0.08, 1.0, (vnoise(p * 1.4 - uTime * 0.08) - 0.5) * 0.08));
        vec3 R = reflect(-V, N);
        vec3 sky = mix(uHorizon, uZenith, clamp(R.y * 1.5, 0.0, 1.0));
        float fres = 0.25 + 0.75 * pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
        vec3 col = mix(uDeep, sky, fres);
        col += uSunColor * pow(max(dot(R, uSunDir), 0.0), 200.0) * 1.5;
        float dist = length(vWorld.xz - cameraPosition.xz);
        col = mix(col, uHorizon, smoothstep(60.0, 190.0, dist));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), material);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(0, 0, -60);
  return lake;
}

/* ─── Ridges and tree line ─── */

function ridgeHeight(x: number, seed: number): number {
  return (
    Math.sin(x * 0.021 + seed) * 0.5 +
    Math.sin(x * 0.047 + seed * 2.1) * 0.3 +
    Math.sin(x * 0.113 + seed * 3.7) * 0.14 +
    Math.sin(x * 0.29 + seed * 5.3) * 0.06
  );
}

export function buildRidges(quality: 'high' | 'low'): THREE.Group {
  const group = new THREE.Group();
  const layers = [
    { z: -78, base: 5, amp: 10, color: '#3f5a4e', seed: 4.1, sides: false },
    { z: -130, base: 11, amp: 18, color: '#5c7470', seed: 2.7, sides: false },
    { z: -200, base: 20, amp: 30, color: '#7f8f92', seed: 6.2, sides: false },
  ];

  for (const layer of layers) {
    const positions: number[] = [];
    const indices: number[] = [];
    const step = 2;
    let i = 0;
    for (let x = -340; x <= 340; x += step) {
      const sideMask = layer.sides ? THREE.MathUtils.smoothstep(Math.abs(x), 16, 42) : 1;
      const y = layer.base + (ridgeHeight(x, layer.seed) * 0.5 + 0.5) * layer.amp * sideMask - (layer.sides ? (1 - sideMask) * 3 : 0);
      positions.push(x, y, layer.z, x, -4, layer.z);
      if (i > 0) {
        const a = (i - 1) * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      i++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: layer.color, fog: true }));
    group.add(mesh);

    // Tree line on the two nearest ridges: soft conifer silhouettes
    if (layer.z > -100) {
      const count = quality === 'high' ? 520 : 240;
      const cone = new THREE.ConeGeometry(1, 3.2, 6);
      cone.translate(0, 1.6, 0);
      const trees = new THREE.InstancedMesh(cone, new THREE.MeshBasicMaterial({ color: layer.sides ? '#233a2e' : '#324c40', fog: true }), count);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      const p = new THREE.Vector3();
      let placed = 0;
      for (let k = 0; k < count * 3 && placed < count; k++) {
        const x = -330 + ((k * 7.31) % 660);
        const sideMask = layer.sides ? THREE.MathUtils.smoothstep(Math.abs(x), 18, 44) : 1;
        if (layer.sides && sideMask < 0.2) continue;
        const y = layer.base + (ridgeHeight(x, layer.seed) * 0.5 + 0.5) * layer.amp * sideMask - (layer.sides ? (1 - sideMask) * 3 : 0);
        const h = 0.7 + ((k * 13.7) % 10) / 10;
        p.set(x + Math.sin(k) * 0.8, y - 0.6, layer.z + 1 + Math.cos(k * 3.1) * 0.6);
        s.set(h * 0.8, h * (1.1 + ((k * 3.3) % 5) / 10), h * 0.8);
        m.compose(p, q, s);
        trees.setMatrixAt(placed++, m);
      }
      trees.count = placed;
      trees.instanceMatrix.needsUpdate = true;
      trees.computeBoundingSphere();
      group.add(trees);
    }
  }
  return group;
}

/* ─── Mist ─── */

export function buildMist(u: SharedUniforms): THREE.Group {
  const group = new THREE.Group();
  const layers = [
    { y: 0.35, scale: 0.035, speed: 0.012, alpha: 0.5 },
    { y: 1.1, scale: 0.025, speed: 0.009, alpha: 0.32 },
    { y: 2.6, scale: 0.018, speed: 0.006, alpha: 0.22 },
  ];
  for (const layer of layers) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: u.uTime,
        uMist: u.uMist,
        uScale: { value: layer.scale },
        uSpeed: { value: layer.speed },
        uAlpha: { value: layer.alpha },
        uOpacity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorld = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uMist;
        uniform float uScale;
        uniform float uSpeed;
        uniform float uAlpha;
        uniform float uOpacity;
        varying vec3 vWorld;
        ${GLSL_NOISE}
        void main() {
          vec2 p = vWorld.xz * uScale + vec2(uTime * uSpeed, uTime * uSpeed * 0.4);
          float n = fbm(p) * 0.7 + fbm(p * 2.3 + 4.0) * 0.3;
          float a = smoothstep(0.42, 0.78, n) * uAlpha;
          float camDist = length(vWorld.xz - cameraPosition.xz);
          a *= smoothstep(4.0, 16.0, camDist) * (1.0 - smoothstep(120.0, 200.0, camDist));
          gl_FragColor = vec4(uMist, a * uOpacity);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(420, 260), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(0, layer.y, -70);
    plane.renderOrder = 4;
    group.add(plane);
  }
  return group;
}

/* ─── Dust motes ─── */

export function glowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

export function buildDust(u: SharedUniforms, glow: THREE.Texture, count: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r1 = Math.sin(i * 12.9898) * 43758.5453;
    const r2 = Math.sin(i * 78.233) * 12345.6789;
    const r3 = Math.sin(i * 39.425) * 24634.6345;
    positions[i * 3] = ((r1 - Math.floor(r1)) - 0.5) * 30;
    positions[i * 3 + 1] = 0.3 + (r2 - Math.floor(r2)) * 5.5;
    positions[i * 3 + 2] = ((r3 - Math.floor(r3)) - 0.5) * 14 - 1;
    seeds[i] = (r1 - Math.floor(r1)) * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: u.uTime, uMap: { value: glow }, uColor: u.uSunColor, uScale: { value: 1 }, uAmount: { value: 0.6 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform float uTime;
      uniform float uScale;
      varying float vTw;
      void main() {
        vec3 p = position;
        p.x += sin(uTime * 0.12 + aSeed) * 0.9;
        p.y += sin(uTime * 0.17 + aSeed * 1.7) * 0.35;
        p.z += cos(uTime * 0.1 + aSeed * 0.6) * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vTw = 0.4 + 0.6 * pow(0.5 + 0.5 * sin(uTime * (0.6 + fract(aSeed) * 0.9) + aSeed * 5.0), 2.0);
        gl_PointSize = uScale * (0.05 + fract(aSeed * 3.1) * 0.06) * 300.0 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      uniform float uAmount;
      varying float vTw;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a;
        gl_FragColor = vec4(uColor * a * vTw * uAmount, 1.0);
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
