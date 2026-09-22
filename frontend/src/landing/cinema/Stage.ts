import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { COLORS, DAYS, SETTINGS, type Layout, type Segment } from '../story';
import {
  buildDust,
  buildMirrorLake,
  buildMist,
  buildRidges,
  buildSimpleLake,
  buildSky,
  createUniforms,
  glowTexture,
  type SharedUniforms,
} from './env';

/* ─── Geometry of the Glass Week ─── */

export const HOUR = 0.34;
const SPACING = 1.25;
const WEEK_GAP = 0.9;
const PLINTH_H = 0.16;
const PLINTH_TOP = 0.1;
const BLOCK_W = 0.78;
const CAP_H = 5 * HOUR;

export function dayX(d: number): number {
  return (d - (DAYS - 1) / 2) * SPACING + (d >= 7 ? WEEK_GAP / 2 : -WEEK_GAP / 2);
}

function dayCapacity(d: number): number {
  return SETTINGS.hoursByWeekday[(d + 1) % 7] ?? 0; // day 0 is Monday
}

/* ─── Camera shots & light moods, one per chapter ─── */

interface Shot {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
}

const SHOTS: Shot[] = [
  { pos: [0, 1.45, 25], look: [0, 4.3, 0], fov: 36 }, // 0 hero
  { pos: [0, 4.4, 16.5], look: [0, 2.0, 0], fov: 42 }, // 1 your week
  { pos: [-6.6, 2.4, 7.4], look: [-3.8, 2.0, 0], fov: 40 }, // 2 your projects
  { pos: [-8.6, 3.6, 14], look: [-3.3, 3.9, 0], fov: 44 }, // 3 the ask
  { pos: [1.4, 3.0, 12.5], look: [1.4, 2.2, 0], fov: 44 }, // 4 the truth
  { pos: [3.2, 5.0, 14], look: [3.2, 1.7, 0], fov: 44 }, // 5 the answer
  { pos: [0, 5.6, 17.5], look: [0, -0.55, 0], fov: 44 }, // 6 try it
  { pos: [0, 12, 24], look: [0, 0.2, -8], fov: 45 }, // 7 what you get
  { pos: [-2.5, 0.5, 12], look: [2.2, 1.9, 0], fov: 36 }, // 8 private
  { pos: [0, 1.7, 18.5], look: [0, 2.6, 0], fov: 40 }, // 9 final
];

/* Phones: frame the part of the week each chapter is about, 3D in the lower half. */
const PORTRAIT_SHOTS: Shot[] = [
  { pos: [0, 2.0, 34], look: [0, 7.2, 0], fov: 50 }, // 0 hero
  { pos: [-4.6, 5.2, 21], look: [-4.6, 4.4, 0], fov: 50 }, // 1 your week
  { pos: [-5.2, 3.4, 13], look: [-4.9, 3.4, 0], fov: 50 }, // 2 your projects
  { pos: [-3.9, 4.4, 18], look: [-3.6, 5.6, 0], fov: 50 }, // 3 the ask
  { pos: [1.8, 4.2, 23.5], look: [1.8, 5.2, 0], fov: 50 }, // 4 the truth
  { pos: [4.2, 5.0, 19], look: [4.2, 4.6, 0], fov: 50 }, // 5 the answer
  { pos: [1.2, 8.5, 30], look: [1.2, -3.2, 0], fov: 50 }, // 6 try it
  { pos: [0, 12, 30], look: [0, 1.5, -8], fov: 52 }, // 7 what you get
  { pos: [2.4, 0.9, 20], look: [2.8, 3.8, 0], fov: 50 }, // 8 private
  { pos: [0, 1.8, 34], look: [0, 6.2, 0], fov: 50 }, // 9 final
];

interface Mood {
  zenith: string;
  horizon: string;
  sun: string;
  mist: string;
  elevation: number;
  azimuth: number;
  sunIntensity: number;
  ambient: number;
  env: number;
  exposure: number;
  fog: number;
  glow: number;
  mistOpacity: number;
  dust: number;
}

// azimuth 0 = sun behind the week (toward -z); 180 = behind the camera
const MOODS: Mood[] = [
  { zenith: '#8199ad', horizon: '#f0d8b4', sun: '#ffc990', mist: '#eadfcb', elevation: 5, azimuth: -14, sunIntensity: 2.2, ambient: 0.8, env: 0.35, exposure: 1.0, fog: 0.0105, glow: 0.35, mistOpacity: 1, dust: 0.75 },
  { zenith: '#6f98c0', horizon: '#e9e3d0', sun: '#ffe6c2', mist: '#ebe6d8', elevation: 18, azimuth: 150, sunIntensity: 2.4, ambient: 0.95, env: 0.45, exposure: 1.0, fog: 0.0085, glow: 0.12, mistOpacity: 0.7, dust: 0.5 },
  { zenith: '#6b97c2', horizon: '#e7e4d4', sun: '#fff0d8', mist: '#ece8dc', elevation: 26, azimuth: 140, sunIntensity: 2.6, ambient: 0.95, env: 0.45, exposure: 1.0, fog: 0.0085, glow: 0.1, mistOpacity: 0.6, dust: 0.5 },
  { zenith: '#5f93c8', horizon: '#e4e8e2', sun: '#fff6e6', mist: '#eceee8', elevation: 48, azimuth: 150, sunIntensity: 2.8, ambient: 1.0, env: 0.5, exposure: 1.02, fog: 0.008, glow: 0.12, mistOpacity: 0.45, dust: 0.45 },
  { zenith: '#4a6583', horizon: '#c6cbcc', sun: '#dce6f4', mist: '#ccd1d2', elevation: 30, azimuth: 115, sunIntensity: 2.0, ambient: 0.75, env: 0.35, exposure: 0.92, fog: 0.012, glow: 0.3, mistOpacity: 0.8, dust: 0.3 },
  { zenith: '#6d86a6', horizon: '#f2cf98', sun: '#ffc27c', mist: '#efdcc0', elevation: 11, azimuth: 160, sunIntensity: 2.5, ambient: 0.85, env: 0.4, exposure: 1.0, fog: 0.009, glow: 0.25, mistOpacity: 0.7, dust: 0.7 },
  { zenith: '#6b98c4', horizon: '#e8e6d8', sun: '#fff0d6', mist: '#ecebe2', elevation: 34, azimuth: 145, sunIntensity: 2.6, ambient: 1.0, env: 0.5, exposure: 1.0, fog: 0.008, glow: 0.12, mistOpacity: 0.5, dust: 0.45 },
  { zenith: '#7195bb', horizon: '#ecdcc0', sun: '#ffe0b2', mist: '#ece2cf', elevation: 20, azimuth: 175, sunIntensity: 2.4, ambient: 0.9, env: 0.45, exposure: 1.0, fog: 0.0075, glow: 0.18, mistOpacity: 0.8, dust: 0.55 },
  { zenith: '#4a5f82', horizon: '#eeae7d', sun: '#ffa564', mist: '#e7c7aa', elevation: 5, azimuth: 20, sunIntensity: 2.0, ambient: 0.65, env: 0.3, exposure: 0.98, fog: 0.0105, glow: 0.55, mistOpacity: 1, dust: 0.9 },
  { zenith: '#34466a', horizon: '#f1a068', sun: '#ff914f', mist: '#e4b695', elevation: 1.6, azimuth: -8, sunIntensity: 1.8, ambient: 0.55, env: 0.28, exposure: 1.0, fog: 0.0115, glow: 0.75, mistOpacity: 1, dust: 1 },
];

const NUM_KEYS = ['elevation', 'azimuth', 'sunIntensity', 'ambient', 'env', 'exposure', 'fog', 'glow', 'mistOpacity', 'dust'] as const;
const COLOR_KEYS = ['zenith', 'horizon', 'sun', 'mist'] as const;
type ParsedMood = Omit<Mood, (typeof COLOR_KEYS)[number]> & Record<(typeof COLOR_KEYS)[number], THREE.Color>;

const ease = (t: number) => t * t * (3 - 2 * t);
const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));

/* ─── Blocks ─── */

interface Block {
  mesh: THREE.Mesh<RoundedBoxGeometry, THREE.MeshPhysicalMaterial>;
  seg: Segment;
  x: number;
  y: number;
  h: number;
  opacity: number;
  target: { y: number; h: number; opacity: number; color: THREE.Color };
  pulse: boolean;
  dying: boolean;
  geomH: number;
}

export interface StageOptions {
  canvas: HTMLCanvasElement;
  quality: 'high' | 'low';
  reducedMotion: boolean;
}

export interface Anchors {
  days: THREE.Vector3[];
  blocks: { seg: Segment; pos: THREE.Vector3; opacity: number }[];
  float: THREE.Vector3 | null;
  beam: THREE.Vector3 | null;
}

export class Stage {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private u: SharedUniforms;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private redLight: THREE.PointLight;
  private fog: THREE.FogExp2;
  private sky: THREE.Mesh;
  private mist: THREE.Group;
  private dust: THREE.Points;
  private lake: THREE.Mesh;
  private pmrem: THREE.PMREMGenerator;
  private envTexture: THREE.Texture;
  private geometryCache = new Map<number, RoundedBoxGeometry>();
  private blocks = new Map<string, Block>();
  private rings: { mesh: THREE.Mesh; opacity: number; target: number; color: THREE.Color }[] = [];
  private beam: THREE.Group;
  private beamState = { x: 0, opacity: 0, target: 0, day: -1 };
  private floatOffer: THREE.Group;
  private floatState = { opacity: 0, target: 0, x: 0, h: 1 };
  private posCurve: THREE.CatmullRomCurve3;
  private lookCurve: THREE.CatmullRomCurve3;
  private shots: Shot[] = SHOTS;
  private moods: ParsedMood[];
  private mood: ParsedMood;
  private chapter = 0;
  private targetChapter = 0;
  private pointer = new THREE.Vector2();
  private pointerSmooth = new THREE.Vector2();
  private lastTime = -1;
  private width = 1;
  private height = 1;
  private dpr: number;
  private maxDpr: number;
  private frameTimes: number[] = [];
  private reducedMotion: boolean;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private scaledPoints: THREE.ShaderMaterial[] = [];

  constructor({ canvas, quality, reducedMotion }: StageOptions) {
    this.reducedMotion = reducedMotion;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
    this.maxDpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : 1.5);
    this.dpr = this.maxDpr;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1200);
    this.u = createUniforms();
    this.fog = new THREE.FogExp2('#efd9b8', 0.01);
    this.scene.fog = this.fog;

    // Soft studio reflections for glass and clear-coat
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;

    this.sun = new THREE.DirectionalLight('#ffffff', 2.4);
    this.sun.castShadow = true;
    const shadowSize = quality === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    const sc = this.sun.shadow.camera;
    sc.left = -14;
    sc.right = 14;
    sc.top = 14;
    sc.bottom = -14;
    sc.near = 1;
    sc.far = 80;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 4;
    this.sun.target.position.set(0, 0.8, 0);
    this.hemi = new THREE.HemisphereLight('#dfe8ee', '#2a3a31', 0.9);
    this.redLight = new THREE.PointLight(COLORS.late, 0, 6, 1.6);
    this.scene.add(this.sun, this.sun.target, this.hemi, this.redLight);

    const glow = glowTexture();
    this.sky = buildSky(this.u);
    this.lake = quality === 'high' ? buildMirrorLake(this.u, 1024) : buildSimpleLake(this.u);
    this.mist = buildMist(this.u);
    this.dust = buildDust(this.u, glow, quality === 'high' ? 320 : 160);
    this.scaledPoints.push(this.dust.material as THREE.ShaderMaterial);
    this.scene.add(this.sky, this.lake, buildRidges(quality), this.mist, this.dust);

    this.buildWeek();
    this.beam = this.buildBeam(glow);
    this.floatOffer = this.buildFloatOffer(glow);
    this.scene.add(this.beam, this.floatOffer);

    this.posCurve = new THREE.CatmullRomCurve3([], false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3([], false, 'centripetal');
    this.useShots(SHOTS);
    this.moods = MOODS.map((m) => ({
      ...m,
      zenith: new THREE.Color(m.zenith),
      horizon: new THREE.Color(m.horizon),
      sun: new THREE.Color(m.sun),
      mist: new THREE.Color(m.mist),
    }));
    this.mood = { ...this.moods[0], zenith: new THREE.Color(), horizon: new THREE.Color(), sun: new THREE.Color(), mist: new THREE.Color() };
  }

  /* ─── Construction ─── */

  private buildWeek() {
    const stone = new THREE.MeshStandardMaterial({ color: '#e2dbcc', roughness: 0.62, metalness: 0 });
    const stoneLow = new THREE.MeshStandardMaterial({ color: '#cfc7b6', roughness: 0.7, metalness: 0 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: 0.06,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.1,
      envMapIntensity: 1.6,
      depthWrite: false,
    });
    const edge = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.28, depthWrite: false });
    const capLine = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false });

    const plinthGeo = new RoundedBoxGeometry(1.04, PLINTH_H, 1.04, 2, 0.035);
    const smallPlinth = new RoundedBoxGeometry(0.84, PLINTH_H * 0.7, 0.84, 2, 0.03);
    const glassGeo = new RoundedBoxGeometry(0.94, CAP_H, 0.94, 3, 0.05);
    const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.94, CAP_H, 0.94));
    const topGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.47, 0, 0.47),
      new THREE.Vector3(0.47, 0, 0.47),
      new THREE.Vector3(0.47, 0, -0.47),
      new THREE.Vector3(-0.47, 0, -0.47),
      new THREE.Vector3(-0.47, 0, 0.47),
    ]);
    const ringGeo = new THREE.RingGeometry(0.66, 0.78, 64);
    ringGeo.rotateX(-Math.PI / 2);

    for (let d = 0; d < DAYS; d++) {
      const x = dayX(d);
      const working = dayCapacity(d) > 0;
      const plinth = new THREE.Mesh(working ? plinthGeo : smallPlinth, working ? stone : stoneLow);
      plinth.position.set(x, PLINTH_TOP - (working ? PLINTH_H : PLINTH_H * 0.7) / 2, 0);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      this.scene.add(plinth);

      if (working) {
        const shell = new THREE.Mesh(glassGeo, glass);
        shell.position.set(x, PLINTH_TOP + CAP_H / 2, 0);
        shell.renderOrder = 3;
        const lines = new THREE.LineSegments(edgeGeo, edge);
        lines.position.copy(shell.position);
        lines.renderOrder = 3;
        const top = new THREE.Line(topGeo, capLine);
        top.position.set(x, PLINTH_TOP + CAP_H, 0);
        top.renderOrder = 3;
        this.scene.add(shell, lines, top);
      }

      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      );
      ring.position.set(x, 0.02, 0);
      ring.renderOrder = 5;
      this.scene.add(ring);
      this.rings.push({ mesh: ring, opacity: 0, target: 0, color: new THREE.Color('#ffffff') });
    }
  }

  private buildBeam(glow: THREE.Texture): THREE.Group {
    const group = new THREE.Group();
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.62, 16, 48, 1, true),
      new THREE.ShaderMaterial({
        uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color('#ffd592') }, uTime: this.u.uTime },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying vec3 vNormalV;
          varying vec3 vViewPos;
          void main() {
            vUv = uv;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vViewPos = -mv.xyz;
            vNormalV = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uOpacity;
          uniform vec3 uColor;
          uniform float uTime;
          varying vec2 vUv;
          varying vec3 vNormalV;
          varying vec3 vViewPos;
          void main() {
            float facing = abs(dot(normalize(vNormalV), normalize(vViewPos)));
            float body = pow(1.0 - facing, 1.5) * 0.35 + 0.1;
            float fade = pow(1.0 - vUv.y, 2.2);
            float shimmer = 0.85 + 0.15 * sin(vUv.y * 40.0 - uTime * 2.0);
            gl_FragColor = vec4(uColor * body * fade * shimmer * uOpacity, 1.0);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    column.position.y = 8;
    column.renderOrder = 7;
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ map: glow, color: '#ffd592', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.03;
    pool.renderOrder = 7;
    group.add(column, pool);
    group.visible = false;
    return group;
  }

  private buildFloatOffer(glow: THREE.Texture): THREE.Group {
    const group = new THREE.Group();
    const block = new THREE.Mesh(
      this.blockGeometry(1),
      new THREE.MeshPhysicalMaterial({
        color: COLORS.amber,
        emissive: COLORS.amber,
        emissiveIntensity: 0.35,
        roughness: 0.3,
        clearcoat: 1,
        clearcoatRoughness: 0.2,
        transparent: true,
        opacity: 0,
      }),
    );
    block.castShadow = true;
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow, color: '#ffc460', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    );
    halo.renderOrder = 6;
    group.add(block, halo);
    group.visible = false;
    return group;
  }

  private blockGeometry(h: number): RoundedBoxGeometry {
    const key = Math.round(h * 100) / 100;
    let geo = this.geometryCache.get(key);
    if (!geo) {
      geo = new RoundedBoxGeometry(BLOCK_W, Math.max(0.02, key - 0.03), BLOCK_W, 3, Math.min(0.06, key / 3));
      this.geometryCache.set(key, geo);
    }
    return geo;
  }

  private useShots(shots: Shot[]) {
    this.shots = shots;
    this.posCurve.points = shots.map((s) => new THREE.Vector3(...s.pos));
    this.lookCurve.points = shots.map((s) => new THREE.Vector3(...s.look));
  }

  /* ─── Public API ─── */

  setChapter(value: number) {
    this.targetChapter = THREE.MathUtils.clamp(value, 0, SHOTS.length - 1);
  }

  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
  }

  snap() {
    this.chapter = this.targetChapter;
  }

  setLayout(layout: Layout) {
    const seen = new Set<string>();
    for (const seg of layout.segments) {
      seen.add(seg.key);
      const h = seg.hours * HOUR;
      const y = PLINTH_TOP + seg.bottom * HOUR + h / 2;
      let b = this.blocks.get(seg.key);
      if (!b) {
        const material = new THREE.MeshPhysicalMaterial({
          color: seg.color,
          emissive: seg.color,
          emissiveIntensity: 0.06,
          roughness: 0.34,
          metalness: 0,
          clearcoat: 0.85,
          clearcoatRoughness: 0.22,
          sheen: 0.5,
          sheenRoughness: 0.55,
          sheenColor: new THREE.Color('#ffffff'),
          transparent: true,
          opacity: 0,
        });
        const mesh = new THREE.Mesh(this.blockGeometry(h), material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const x = dayX(seg.day);
        mesh.position.set(x, y + 2.2, 0);
        this.scene.add(mesh);
        b = {
          mesh,
          seg,
          x,
          y: y + 2.2,
          h,
          opacity: 0,
          target: { y, h, opacity: 1, color: new THREE.Color(seg.color) },
          pulse: false,
          dying: false,
          geomH: h,
        };
        this.blocks.set(seg.key, b);
      }
      b.seg = seg;
      b.dying = false;
      b.target.y = y;
      b.target.h = h;
      b.target.opacity = 1;
      b.target.color.set(seg.color);
      b.pulse = seg.tone === 'late' || seg.tone === 'offerLate';
      if (Math.abs(b.geomH - h) > 0.001) {
        // Swap to the exact geometry, keep the on-screen height continuous via scale
        b.mesh.geometry = this.blockGeometry(h);
        b.geomH = h;
      }
    }
    for (const [key, b] of this.blocks) {
      if (seen.has(key)) continue;
      b.dying = true;
      b.target.opacity = 0;
      b.target.y = b.y + 1.4;
    }

    this.rings.forEach((r) => (r.target = 0));
    for (const ring of layout.rings) {
      const r = this.rings[ring.day];
      if (!r) continue;
      r.target = 1;
      r.color.set(ring.color);
    }

    if (layout.beamDay !== null && layout.beamDay >= 0 && layout.beamDay < DAYS) {
      if (this.beamState.opacity < 0.05) this.beamState.x = dayX(layout.beamDay);
      this.beamState.day = layout.beamDay;
      this.beamState.target = 1;
    } else {
      this.beamState.target = 0;
    }

    if (layout.floatOffer) {
      this.floatState.target = 1;
      this.floatState.x = dayX(layout.floatOffer.day);
      const h = layout.floatOffer.hours * HOUR;
      if (Math.abs(this.floatState.h - h) > 0.001) {
        this.floatState.h = h;
        (this.floatOffer.children[0] as THREE.Mesh).geometry = this.blockGeometry(h);
      }
    } else {
      this.floatState.target = 0;
    }
  }

  anchors(): Anchors {
    const days = Array.from({ length: DAYS }, (_, d) => new THREE.Vector3(dayX(d), 0, 0.66));
    const blocks = [...this.blocks.values()]
      .filter((b) => !b.dying)
      .map((b) => ({ seg: b.seg, pos: new THREE.Vector3(b.x, b.y, 0.4), opacity: b.opacity }));
    const float = this.floatState.opacity > 0.05
      ? new THREE.Vector3(this.floatState.x, this.floatOffer.position.y + this.floatState.h / 2 + 0.15, 0)
      : null;
    const beam = this.beamState.opacity > 0.05 ? new THREE.Vector3(this.beamState.x, CAP_H + 1.1, 0) : null;
    return { days, blocks, float, beam };
  }

  /** World → CSS pixel coordinates. */
  toScreen(v: THREE.Vector3): { x: number; y: number; visible: boolean } {
    this.tmp.copy(v).project(this.camera);
    return {
      x: (this.tmp.x * 0.5 + 0.5) * this.width,
      y: (-this.tmp.y * 0.5 + 0.5) * this.height,
      visible: this.tmp.z < 1 && Math.abs(this.tmp.x) < 1.2 && Math.abs(this.tmp.y) < 1.2,
    };
  }

  resize(width: number, height: number) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    const shots = this.camera.aspect < 0.8 ? PORTRAIT_SHOTS : SHOTS;
    if (shots !== this.shots) this.useShots(shots);
    this.updatePointScale();
  }

  private updatePointScale() {
    const pxPerUnit = (this.height * this.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    for (const m of this.scaledPoints) m.uniforms.uScale.value = pxPerUnit / 300;
  }

  /* ─── Frame ─── */

  render(time: number) {
    const dt = this.lastTime < 0 ? 1 / 60 : Math.min(time - this.lastTime, 0.1);
    this.lastTime = time;
    const idle = this.reducedMotion ? 0 : 1;

    this.chapter = damp(this.chapter, this.targetChapter, this.reducedMotion ? 14 : 3.6, dt);
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 2.2));

    this.blendMood(this.chapter);
    this.applyMood(time * idle);
    this.placeCamera(time * idle);
    this.sky.position.copy(this.camera.position);

    this.animateBlocks(time, dt);
    this.animateMarkers(time, dt);

    this.renderer.render(this.scene, this.camera);
    this.adapt(dt);
  }

  private blendMood(c: number) {
    const i = Math.min(Math.floor(c), this.moods.length - 2);
    const t = ease(THREE.MathUtils.clamp(c - i, 0, 1));
    const a = this.moods[i];
    const b = this.moods[i + 1];
    for (const k of NUM_KEYS) this.mood[k] = a[k] + (b[k] - a[k]) * t;
    for (const k of COLOR_KEYS) this.mood[k].copy(a[k]).lerp(b[k], t);
  }

  private applyMood(time: number) {
    const m = this.mood;
    const el = THREE.MathUtils.degToRad(m.elevation);
    const az = THREE.MathUtils.degToRad(m.azimuth);
    const dir = this.u.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    this.u.uZenith.value.copy(m.zenith);
    this.u.uHorizon.value.copy(m.horizon);
    this.u.uSunColor.value.copy(m.sun);
    this.u.uMist.value.copy(m.mist);
    this.u.uSunGlow.value = 0.9;
    this.u.uTime.value = time;

    this.fog.color.copy(m.horizon).lerp(m.zenith, 0.1);
    this.fog.density = m.fog;
    this.sun.color.copy(m.sun);
    this.sun.intensity = m.sunIntensity;
    this.sun.position.copy(this.sun.target.position).addScaledVector(dir, 40);
    this.hemi.color.copy(m.zenith).lerp(new THREE.Color('#ffffff'), 0.5);
    this.hemi.groundColor.set('#2a3a31');
    this.hemi.intensity = m.ambient;
    this.scene.environmentIntensity = m.env;
    this.renderer.toneMappingExposure = m.exposure;
    for (const plane of this.mist.children) {
      ((plane as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uOpacity.value = m.mistOpacity;
    }
    (this.dust.material as THREE.ShaderMaterial).uniforms.uAmount.value = m.dust;
  }

  private placeCamera(time: number) {
    const c = this.chapter;
    const shots = this.shots;
    const t = c / (shots.length - 1);
    const pos = this.posCurve.getPoint(t, this.tmp);
    const look = this.lookCurve.getPoint(t, this.tmp2);
    const i = Math.min(Math.floor(c), shots.length - 2);
    let fov = shots[i].fov + (shots[i + 1].fov - shots[i].fov) * ease(c - i);

    // Squarish screens (tablets): step back and widen so the whole week still reads
    const aspect = this.width / this.height;
    if (aspect < 1.2 && aspect >= 0.8) {
      const k = (1.2 - aspect) / 1.2;
      const back = pos.clone().sub(look).normalize();
      pos.addScaledVector(back, k * 16);
      look.x *= 1 - k * 0.6;
      fov += k * 10;
    }

    const breathe = Math.sin(time * 0.3) * 0.08;
    this.camera.position.set(
      pos.x + this.pointerSmooth.x * 0.5,
      pos.y + breathe + this.pointerSmooth.y * 0.25,
      pos.z,
    );
    this.camera.lookAt(look);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
      this.updatePointScale();
    }
  }

  private animateBlocks(time: number, dt: number) {
    const glow = this.mood.glow;
    let lateCount = 0;
    const lateCenter = new THREE.Vector3();
    for (const [key, b] of this.blocks) {
      b.y = damp(b.y, b.target.y, 7, dt);
      b.h = damp(b.h, b.target.h, 7, dt);
      b.opacity = damp(b.opacity, b.target.opacity, 6, dt);
      const mat = b.mesh.material;
      mat.color.lerp(b.target.color, 1 - Math.exp(-5 * dt));
      mat.emissive.copy(mat.color);
      const pulse = b.pulse ? 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(time * 3.2)) : 0;
      mat.emissiveIntensity = 0.05 + glow * 0.3 + pulse;
      mat.opacity = b.opacity;
      mat.transparent = b.opacity < 0.995;
      b.mesh.visible = b.opacity > 0.01;
      b.mesh.position.set(b.x, b.y, 0);
      b.mesh.scale.set(1, b.h / b.geomH, 1);
      if (b.pulse && b.opacity > 0.5) {
        lateCount++;
        lateCenter.add(b.mesh.position);
      }
      if (b.dying && b.opacity < 0.01) {
        this.scene.remove(b.mesh);
        b.mesh.material.dispose();
        this.blocks.delete(key);
      }
    }
    if (lateCount) {
      lateCenter.divideScalar(lateCount);
      this.redLight.position.set(lateCenter.x, lateCenter.y + 0.4, 1.2);
    }
    this.redLight.intensity = damp(this.redLight.intensity, lateCount ? 2.2 : 0, 4, dt);
  }

  private animateMarkers(time: number, dt: number) {
    for (const r of this.rings) {
      r.opacity = damp(r.opacity, r.target, 5, dt);
      const mat = r.mesh.material as THREE.MeshBasicMaterial;
      mat.color.copy(r.color);
      mat.opacity = r.opacity * (0.7 + 0.3 * Math.sin(time * 2.4));
      r.mesh.visible = r.opacity > 0.01;
    }

    const bs = this.beamState;
    bs.opacity = damp(bs.opacity, bs.target, 3.2, dt);
    if (bs.day >= 0) bs.x = damp(bs.x, dayX(bs.day), 5, dt);
    this.beam.visible = bs.opacity > 0.01;
    this.beam.position.x = bs.x;
    ((this.beam.children[0] as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.uOpacity.value = bs.opacity;
    ((this.beam.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = bs.opacity * 0.9;

    const fs = this.floatState;
    fs.opacity = damp(fs.opacity, fs.target, 4, dt);
    this.floatOffer.visible = fs.opacity > 0.01;
    const bob = Math.sin(time * 1.1) * 0.08;
    this.floatOffer.position.set(fs.x, PLINTH_TOP + CAP_H + 0.9 + fs.h / 2 + bob + (1 - fs.opacity) * 1.5, 0);
    const block = this.floatOffer.children[0] as THREE.Mesh<RoundedBoxGeometry, THREE.MeshPhysicalMaterial>;
    block.rotation.y = time * 0.25;
    block.material.opacity = fs.opacity;
    const halo = this.floatOffer.children[1] as THREE.Sprite;
    halo.scale.set(3.2, fs.h + 2.6, 1);
    halo.material.opacity = fs.opacity * 0.45;
  }

  private adapt(dt: number) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 0.022 && this.dpr > 0.8) this.dpr = Math.max(0.8, this.dpr - 0.2);
    else if (avg < 0.0125 && this.dpr < this.maxDpr) this.dpr = Math.min(this.maxDpr, this.dpr + 0.1);
    else return;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.updatePointScale();
  }

  dispose() {
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
      for (const m of mats) m.dispose();
    });
    this.geometryCache.forEach((g) => g.dispose());
    this.envTexture.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
