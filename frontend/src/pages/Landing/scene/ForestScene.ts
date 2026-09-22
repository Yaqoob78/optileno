import * as THREE from 'three';
import {
  buildFireflies,
  buildForest,
  buildGrass,
  buildHeroTree,
  buildLake,
  buildLightShafts,
  buildPlateau,
  buildSky,
  buildTerrain,
  createSharedUniforms,
  glowTexture,
  type Quality,
  type SharedUniforms,
} from './world';

/* One keyframe per page chapter (hero → final CTA). The scroll position is
   mapped to a fractional chapter index; the camera glides along a spline
   through these points while the light moves from dawn to sunset. */

interface Shot {
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
}

interface Mood {
  zenith: string;
  horizon: string;
  sun: string;
  sky: string;
  ground: string;
  /** Sun elevation / azimuth in degrees (azimuth 0 = straight down the valley). */
  elevation: number;
  azimuth: number;
  sunIntensity: number;
  ambient: number;
  sunGlow: number;
  lanterns: number;
  exposure: number;
  fogDensity: number;
  shafts: number;
}

export const CHAPTER_COUNT = 10;

const SHOTS: Shot[] = [
  { pos: [-6, 6.5, 40], look: [-12, 11.5, 0], fov: 46 }, // 01 hero — the tree
  { pos: [16, 11, -26], look: [-18, 1, -170], fov: 50 }, // 02 valley vista
  { pos: [34, 7, 26], look: [4, 10, -4], fov: 44 }, // 03 features
  { pos: [-34, 12, 24], look: [-6, 11, -6], fov: 44 }, // 04 chat
  { pos: [-3, 2.8, 22], look: [1, 10, -2], fov: 50 }, // 05 planner — under the canopy
  { pos: [36, 12, -34], look: [12, 9, 8], fov: 48 }, // 06 analytics — looking back, front-lit
  { pos: [-23, 4.5, 20], look: [-1, 9, -6], fov: 44 }, // 07 people — golden hour
  { pos: [2, 38, 52], look: [0, 0, -90], fov: 48 }, // 08 pricing — aerial
  { pos: [10, 20, 40], look: [-4, 4, -70], fov: 48 }, // 09 faq
  { pos: [6, 4.2, 40], look: [-14, 8.5, -12], fov: 46 }, // 10 final — sunset
];

const MOODS: Mood[] = [
  // 01 soft golden morning
  { zenith: '#56798f', horizon: '#e6cf9f', sun: '#ffd49a', sky: '#c3d3c2', ground: '#2c3826', elevation: 11, azimuth: -14, sunIntensity: 2.4, ambient: 0.72, sunGlow: 0.8, lanterns: 0.8, exposure: 0.88, fogDensity: 0.0044, shafts: 0.7 },
  // 02 clear bright morning
  { zenith: '#5a8db8', horizon: '#dcd3b0', sun: '#ffe9c4', sky: '#cfdcd2', ground: '#34442c', elevation: 14, azimuth: -38, sunIntensity: 2.8, ambient: 0.85, sunGlow: 0.5, lanterns: 0.2, exposure: 0.9, fogDensity: 0.002, shafts: 0.3 },
  // 03–06 calm daylight, dimmed so the product UI reads
  { zenith: '#5d86a6', horizon: '#dfe0c6', sun: '#fff1d2', sky: '#d4e2d6', ground: '#32412a', elevation: 22, azimuth: -30, sunIntensity: 2.8, ambient: 0.95, sunGlow: 0.5, lanterns: 0.35, exposure: 0.78, fogDensity: 0.004, shafts: 0.35 },
  { zenith: '#5a82a2', horizon: '#e2dcc0', sun: '#ffeccb', sky: '#d1ded0', ground: '#30402a', elevation: 20, azimuth: -18, sunIntensity: 2.7, ambient: 0.9, sunGlow: 0.55, lanterns: 0.4, exposure: 0.74, fogDensity: 0.0042, shafts: 0.4 },
  { zenith: '#56809f', horizon: '#e6d8b6', sun: '#ffe6bd', sky: '#cfdccb', ground: '#2f3e28', elevation: 17, azimuth: -10, sunIntensity: 2.6, ambient: 0.88, sunGlow: 0.6, lanterns: 0.55, exposure: 0.74, fogDensity: 0.0044, shafts: 0.5 },
  { zenith: '#5b87a8', horizon: '#dfd8b8', sun: '#ffe2b4', sky: '#cbd8c6', ground: '#2e3b27', elevation: 14, azimuth: -16, sunIntensity: 2.6, ambient: 0.85, sunGlow: 0.5, lanterns: 0.45, exposure: 0.9, fogDensity: 0.0026, shafts: 0.3 },
  // 07 golden hour
  { zenith: '#4d6f93', horizon: '#f5c27f', sun: '#ffb867', sky: '#d9c9a4', ground: '#2f3424', elevation: 6.5, azimuth: -8, sunIntensity: 2.6, ambient: 0.75, sunGlow: 0.95, lanterns: 0.85, exposure: 0.95, fogDensity: 0.0046, shafts: 0.9 },
  // 08 pricing — dusk, dimmed
  { zenith: '#2e4163', horizon: '#e8975e', sun: '#ff9c55', sky: '#a79a88', ground: '#262a20', elevation: 3.5, azimuth: -12, sunIntensity: 2.0, ambient: 0.55, sunGlow: 1.0, lanterns: 0.95, exposure: 0.8, fogDensity: 0.003, shafts: 0.7 },
  { zenith: '#2a3b5c', horizon: '#ea925a', sun: '#ff9650', sky: '#9c917f', ground: '#23271e', elevation: 2.5, azimuth: -12, sunIntensity: 1.9, ambient: 0.5, sunGlow: 1.0, lanterns: 1.0, exposure: 0.8, fogDensity: 0.003, shafts: 0.7 },
  // 10 sunset
  { zenith: '#27365a', horizon: '#f29a58', sun: '#ff9148', sky: '#a08f7c', ground: '#22251d', elevation: 1.8, azimuth: -14, sunIntensity: 2.1, ambient: 0.55, sunGlow: 1.15, lanterns: 1.0, exposure: 1.0, fogDensity: 0.0046, shafts: 1.0 },
];

interface ParsedMood extends Omit<Mood, 'zenith' | 'horizon' | 'sun' | 'sky' | 'ground'> {
  zenith: THREE.Color;
  horizon: THREE.Color;
  sun: THREE.Color;
  sky: THREE.Color;
  ground: THREE.Color;
}

const NUMERIC_KEYS = [
  'elevation', 'azimuth', 'sunIntensity', 'ambient', 'sunGlow', 'lanterns', 'exposure', 'fogDensity', 'shafts',
] as const;
const COLOR_KEYS = ['zenith', 'horizon', 'sun', 'sky', 'ground'] as const;

const ease = (t: number) => t * t * (3 - 2 * t);

export interface ForestSceneOptions {
  canvas: HTMLCanvasElement;
  quality: Quality;
  reducedMotion: boolean;
}

export class ForestScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private overlayScene = new THREE.Scene();
  private overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private u: SharedUniforms;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private fog: THREE.FogExp2;
  private sky: THREE.Mesh;
  private shafts: ReturnType<typeof buildLightShafts>;
  private scaledPoints: THREE.ShaderMaterial[] = [];

  private posCurve: THREE.CatmullRomCurve3;
  private lookCurve: THREE.CatmullRomCurve3;
  private moods: ParsedMood[];
  private mood: ParsedMood;

  private chapter = 0;
  private targetChapter = 0;
  private pointer = new THREE.Vector2();
  private pointerSmooth = new THREE.Vector2();
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private lastTime = -1;
  private width = 1;
  private height = 1;
  private maxDpr: number;
  private dpr: number;
  private frameTimes: number[] = [];
  private reducedMotion: boolean;
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();

  constructor({ canvas, quality, reducedMotion }: ForestSceneOptions) {
    this.reducedMotion = reducedMotion;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.maxDpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : 1.35);
    this.dpr = this.maxDpr;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.autoClear = false;

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.5, 2400);
    this.u = createSharedUniforms();

    this.fog = new THREE.FogExp2('#e8dcc0', 0.0042);
    this.scene.fog = this.fog;

    this.sunLight = new THREE.DirectionalLight('#ffffff', 2.6);
    this.hemiLight = new THREE.HemisphereLight('#d6e3d6', '#34422c', 0.9);
    this.scene.add(this.sunLight, this.sunLight.target, this.hemiLight);

    const glow = glowTexture();
    this.sky = buildSky(this.u);
    const tree = buildHeroTree(this.u, quality, glow, true);
    const fireflies = buildFireflies(this.u, quality, glow);
    this.scene.add(
      this.sky,
      buildTerrain(quality),
      buildLake(this.u),
      buildPlateau(quality, tree.canopyRadius),
      tree.group,
      buildGrass(this.u, quality),
      buildForest(quality),
      fireflies,
    );
    this.scaledPoints.push(fireflies.material as THREE.ShaderMaterial);
    tree.group.traverse((o) => {
      if (o.userData.isHalo) this.scaledPoints.push((o as THREE.Points).material as THREE.ShaderMaterial);
    });

    this.shafts = buildLightShafts(this.u);
    this.overlayScene.add(this.shafts.mesh);

    this.posCurve = new THREE.CatmullRomCurve3(SHOTS.map((s) => new THREE.Vector3(...s.pos)), false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(SHOTS.map((s) => new THREE.Vector3(...s.look)), false, 'centripetal');
    this.moods = MOODS.map((m) => ({
      ...m,
      zenith: new THREE.Color(m.zenith),
      horizon: new THREE.Color(m.horizon),
      sun: new THREE.Color(m.sun),
      sky: new THREE.Color(m.sky),
      ground: new THREE.Color(m.ground),
    }));
    this.mood = { ...this.moods[0], zenith: new THREE.Color(), horizon: new THREE.Color(), sun: new THREE.Color(), sky: new THREE.Color(), ground: new THREE.Color() };

    this.placeCamera(0);
  }

  /** Fractional chapter index, 0 … CHAPTER_COUNT - 1. */
  setChapter(value: number) {
    this.targetChapter = Math.min(Math.max(value, 0), CHAPTER_COUNT - 1);
  }

  /** Normalised pointer, -1 … 1 on both axes. */
  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
  }

  /** Jump straight to the current scroll position (first frame, resize). */
  snap() {
    this.chapter = this.targetChapter;
    this.placeCamera(this.chapter);
  }

  resize(width: number, height: number) {
    this.width = Math.max(width, 1);
    this.height = Math.max(height, 1);
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.shafts.aspect.value = this.width / this.height;
    this.updatePointScale();
  }

  private updatePointScale() {
    const pxPerUnit = (this.height * this.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    const scale = pxPerUnit / 300;
    for (const mat of this.scaledPoints) mat.uniforms.uScale.value = scale;
  }

  private blendMood(c: number) {
    const i = Math.min(Math.floor(c), CHAPTER_COUNT - 2);
    const t = ease(Math.min(Math.max(c - i, 0), 1));
    const a = this.moods[i];
    const b = this.moods[i + 1];
    for (const k of NUMERIC_KEYS) this.mood[k] = a[k] + (b[k] - a[k]) * t;
    for (const k of COLOR_KEYS) this.mood[k].copy(a[k]).lerp(b[k], t);
  }

  private placeCamera(c: number) {
    const t = c / (CHAPTER_COUNT - 1);
    this.posCurve.getPoint(t, this.tmpV);
    this.lookCurve.getPoint(t, this.tmpV2);

    // Portrait screens: step back, centre the subject and lift it above the copy
    const aspect = this.width / this.height;
    if (aspect < 1) {
      const back = (1 - aspect) * 0.9;
      const dir = this.tmpV.clone().sub(this.tmpV2).normalize();
      this.tmpV.addScaledVector(dir, back * 22);
      this.tmpV2.x *= 1 - back * 0.5;
      this.tmpV2.y -= back * 7;
    }

    this.camPos.copy(this.tmpV);
    this.camLook.copy(this.tmpV2);

    const i = Math.min(Math.floor(c), CHAPTER_COUNT - 2);
    const f = ease(c - i);
    const fov = SHOTS[i].fov + (SHOTS[i + 1].fov - SHOTS[i].fov) * f;
    const portraitFov = aspect < 1 ? fov + (1 - aspect) * 16 : fov;
    if (Math.abs(this.camera.fov - portraitFov) > 0.01) {
      this.camera.fov = portraitFov;
      this.camera.updateProjectionMatrix();
      this.updatePointScale();
    }
  }

  private applyMood(time: number) {
    const m = this.mood;
    const el = THREE.MathUtils.degToRad(m.elevation);
    const az = THREE.MathUtils.degToRad(m.azimuth);
    const sunDir = this.u.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();

    this.u.uZenith.value.copy(m.zenith);
    this.u.uHorizon.value.copy(m.horizon);
    this.u.uSunColor.value.copy(m.sun);
    this.u.uSkyColor.value.copy(m.sky).multiplyScalar(m.ambient);
    this.u.uGroundColor.value.copy(m.ground).multiplyScalar(m.ambient);
    this.u.uSunGlow.value = m.sunGlow;
    this.u.uGlow.value = m.lanterns;
    this.u.uTime.value = time;

    this.fog.color.copy(m.horizon).lerp(m.zenith, 0.12);
    this.fog.density = m.fogDensity;

    this.sunLight.color.copy(m.sun);
    this.sunLight.intensity = m.sunIntensity;
    this.sunLight.position.copy(sunDir).multiplyScalar(100);
    this.hemiLight.color.copy(m.sky);
    this.hemiLight.groundColor.copy(m.ground);
    this.hemiLight.intensity = m.ambient * 1.35;
    this.renderer.toneMappingExposure = m.exposure;
  }

  private updateShafts() {
    const sunWorld = this.tmpV.copy(this.camera.position).addScaledVector(this.u.uSunDir.value, 800);
    sunWorld.project(this.camera);
    const inFront = sunWorld.z < 1;
    this.shafts.sunScreen.set(sunWorld.x * 0.5 + 0.5, sunWorld.y * 0.5 + 0.5);
    // Fade out as the sun leaves the frame
    const off = Math.max(Math.abs(sunWorld.x), Math.abs(sunWorld.y));
    const visible = inFront ? 1 - THREE.MathUtils.smoothstep(off, 1.0, 2.2) : 0;
    this.shafts.strength.value = this.mood.shafts * visible;
  }

  private adaptResolution(dt: number) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    // Consistently slower than ~45fps → shed pixels to protect smoothness
    if (avg > 0.022 && this.dpr > 0.8) {
      this.dpr = Math.max(0.8, this.dpr - 0.2);
    } else if (avg < 0.0125 && this.dpr < this.maxDpr) {
      this.dpr = Math.min(this.maxDpr, this.dpr + 0.1);
    } else {
      return;
    }
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.width, this.height, false);
    this.updatePointScale();
  }

  /** Advance and draw one frame. `time` is in seconds. */
  render(time: number) {
    const dt = this.lastTime < 0 ? 1 / 60 : Math.min(time - this.lastTime, 0.1);
    this.lastTime = time;

    // Critically-damped follow of the scroll target: silky even on coarse wheels
    const k = 1 - Math.exp(-dt * (this.reducedMotion ? 12 : 3.4));
    this.chapter += (this.targetChapter - this.chapter) * k;
    this.pointerSmooth.lerp(this.pointer, 1 - Math.exp(-dt * 2.5));

    this.blendMood(this.chapter);
    this.placeCamera(this.chapter);

    const idle = this.reducedMotion ? 0 : 1;
    const breathe = Math.sin(time * 0.35) * 0.35 * idle;
    this.camera.position.set(
      this.camPos.x + this.pointerSmooth.x * 1.1 * idle,
      this.camPos.y + breathe + this.pointerSmooth.y * 0.55 * idle,
      this.camPos.z,
    );
    this.camera.lookAt(this.camLook);
    this.sky.position.copy(this.camera.position);

    this.applyMood(this.reducedMotion ? 0 : time);
    this.u.uWind.value = this.reducedMotion ? 0 : 1;
    this.updateShafts();

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.shafts.strength.value > 0.01) {
      this.renderer.render(this.overlayScene, this.overlayCamera);
    }

    this.adaptResolution(dt);
  }

  dispose() {
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
      for (const mat of mats) {
        for (const value of Object.values(mat)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        if ((mat as THREE.ShaderMaterial).uniforms) {
          for (const uni of Object.values((mat as THREE.ShaderMaterial).uniforms)) {
            if (uni && uni.value instanceof THREE.Texture) uni.value.dispose();
          }
        }
        mat.dispose();
      }
    });
    this.shafts.mesh.geometry.dispose();
    (this.shafts.mesh.material as THREE.Material).dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
