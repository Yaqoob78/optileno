/* A living painting: one full-screen WebGL2 quad that turns a flat illustration
   plus its depth map into a scene you can look into. Near things move more than
   far things (cursor parallax, idle "breathing", a scroll-driven dolly push),
   and chapters change by flying through a bank of clouds.

   No three.js: a single fragment shader is all this needs (~6 KB). */

export interface StageScene {
  id: string;
  image: string;
  /** Lighter image for narrow screens. */
  imageSmall?: string;
  depth: string;
  /** Optional seamless loop; replaces the still once it plays (desktop only). */
  video?: string;
  /** Point of the image that must stay in frame on narrow screens (0..1). */
  focus: [number, number];
  /** exposure, warmth (0..1), saturation */
  grade?: [number, number, number];
}

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); // y down, like image rows
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uImgA, uDepA, uImgB, uDepB;
uniform vec2 uRes, uSizeA, uSizeB, uFocusA, uFocusB;
uniform vec3 uGradeA, uGradeB;
uniform float uMix, uTime, uDolly, uIntensity, uClouds;
uniform vec2 uPointer;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

// "cover" crop that keeps a focal point in frame
vec2 cover(vec2 uv, vec2 img, vec2 focus, float zoom) {
  float ca = uRes.x / uRes.y, ia = img.x / img.y;
  vec2 win = ca > ia ? vec2(1.0, ia / ca) : vec2(ca / ia, 1.0);
  win /= zoom;
  vec2 origin = clamp(focus - win * 0.5, vec2(0.0), vec2(1.0) - win);
  return origin + uv * win;
}

vec3 scene(sampler2D img, sampler2D dep, vec2 size, vec2 focus, vec3 grade, float push, vec2 uv) {
  float zoom = 1.07 + push;
  vec2 base = cover(uv, size, focus, zoom);
  vec2 breathe = vec2(sin(uTime * 0.19), cos(uTime * 0.23)) * 0.45;
  vec2 cam = (uPointer + breathe) * uIntensity;
  vec2 toFocus = base - focus;
  // Displace by depth; a few refinement steps keep edges from tearing
  vec2 p = base;
  for (int i = 0; i < 3; i++) {
    float d = texture(dep, p).r;
    p = base + cam * (d - 0.4) * vec2(0.020, 0.014) - toFocus * (uDolly * 0.045 + push * 0.6) * d;
  }
  vec3 c = texture(img, clamp(p, vec2(0.001), vec2(0.999))).rgb;
  c *= grade.x;
  c = mix(c, c * vec3(1.07, 1.0, 0.9), grade.y);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  return mix(vec3(l), c, grade.z);
}

void main() {
  vec2 uv = vUv;
  float t = uMix;
  float mid = sin(t * 3.14159265);
  vec3 a = scene(uImgA, uDepA, uSizeA, uFocusA, uGradeA, t * 0.30, uv);
  vec3 b = scene(uImgB, uDepB, uSizeB, uFocusB, uGradeB, (1.0 - t) * 0.10, uv);

  float n = fbm(uv * vec2(3.2, 2.1) + vec2(uTime * 0.02, 0.0));
  float swap = smoothstep(0.36, 0.64, t + (n - 0.5) * 0.45);
  vec3 col = mix(a, b, swap);

  // A bank of cloud we fly through between chapters
  // Two layers of billow moving past at different speeds read as depth
  float cn = fbm(uv * vec2(2.3, 1.5) + vec2(uTime * 0.035 + t * 1.4, t * 0.35));
  float cn2 = fbm(uv * vec2(5.2, 3.3) - vec2(t * 2.2, uTime * 0.02));
  float dens = cn * 0.68 + cn2 * 0.32;
  float cloudAmt = smoothstep(0.38, 0.9, dens + mid * 0.34) * smoothstep(0.0, 0.55, mid);
  float lit = smoothstep(0.25, 0.85, cn2 * 0.6 + (1.0 - uv.y) * 0.5);
  vec3 cloud = mix(vec3(0.80, 0.80, 0.86), vec3(1.0, 0.96, 0.9), lit);
  col = mix(col, cloud, clamp(cloudAmt * 1.15, 0.0, 0.96));

  // Low drifting haze, so still scenes never feel frozen
  float haze = fbm(vec2(uv.x * 1.6 - uTime * 0.012, uv.y * 3.0 + uTime * 0.004));
  col = mix(col, vec3(1.0, 0.97, 0.92), smoothstep(0.55, 0.9, haze) * smoothstep(0.35, 1.0, uv.y) * 0.10 * uClouds);

  // Vignette and a whisper of grain
  vec2 q = uv - 0.5;
  col *= 1.0 - dot(q, q) * 0.32;
  col += (hash(uv * uRes + uTime) - 0.5) * 0.018;
  outColor = vec4(col, 1.0);
}`;

interface Tex {
  img: WebGLTexture;
  dep: WebGLTexture;
  w: number;
  h: number;
  video?: HTMLVideoElement;
  /** A decoded video frame is waiting to be uploaded. */
  fresh?: boolean;
  /** When the last video frame was uploaded (fallback without frame callbacks). */
  uploadedAt?: number;
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = () => window.matchMedia('(max-width: 900px)').matches;
const saveData = () => !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

export class DepthStage {
  private gl: WebGL2RenderingContext;
  private prog: WebGLProgram;
  private u: Record<string, WebGLUniformLocation | null> = {};
  private textures = new Map<string, Tex>();
  private pending = new Map<string, Promise<Tex | null>>();
  private scenes: StageScene[];
  private from = 0;
  private to = 0;
  private mix = 1;
  private mixStart = 0;
  private raf = 0;
  private running = false;
  private pointer = [0, 0];
  private pointerTarget = [0, 0];
  private dolly = 0;
  private dollyTarget = 0;
  private start = performance.now();
  private intensity = reduced() ? 0 : 1;
  private disposed = false;
  private hasScene = false;
  onReady?: () => void;

  static create(canvas: HTMLCanvasElement, scenes: StageScene[]): DepthStage | null {
    try {
      const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
      if (!gl) return null;
      return new DepthStage(canvas, gl, scenes);
    } catch {
      return null;
    }
  }

  private constructor(
    private canvas: HTMLCanvasElement,
    gl: WebGL2RenderingContext,
    scenes: StageScene[],
  ) {
    this.gl = gl;
    this.scenes = scenes;
    this.prog = this.program();
    gl.useProgram(this.prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const name of ['uImgA', 'uDepA', 'uImgB', 'uDepB', 'uRes', 'uSizeA', 'uSizeB', 'uFocusA', 'uFocusB', 'uGradeA', 'uGradeB', 'uMix', 'uTime', 'uDolly', 'uIntensity', 'uPointer', 'uClouds']) {
      this.u[name] = gl.getUniformLocation(this.prog, name);
    }
    gl.uniform1i(this.u.uImgA, 0);
    gl.uniform1i(this.u.uDepA, 1);
    gl.uniform1i(this.u.uImgB, 2);
    gl.uniform1i(this.u.uDepB, 3);
    this.resize();
  }

  private program(): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    return p;
  }

  private upload(source: TexImageSource | null, tex?: WebGLTexture): WebGLTexture {
    const gl = this.gl;
    const t = tex ?? gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([128, 128, 128, 255]));
    return t;
  }

  /** Loads (once) the textures for a scene. Resolves null if an asset is missing. */
  load(index: number): Promise<Tex | null> {
    const s = this.scenes[index];
    if (!s) return Promise.resolve(null);
    const hit = this.textures.get(s.id);
    if (hit) return Promise.resolve(hit);
    const inflight = this.pending.get(s.id);
    if (inflight) return inflight;
    const image = narrow() && s.imageSmall ? s.imageSmall : s.image;
    const p = Promise.all([loadImage(image), loadImage(s.depth)])
      .then(([img, dep]) => {
        if (this.disposed) return null;
        const tex: Tex = { img: this.upload(img), dep: this.upload(dep), w: img.naturalWidth, h: img.naturalHeight };
        if (s.video && !reduced() && !narrow() && !saveData()) this.attachVideo(s.video, tex);
        this.textures.set(s.id, tex);
        return tex;
      })
      .catch(() => null);
    this.pending.set(s.id, p);
    return p;
  }

  private attachVideo(src: string, tex: Tex) {
    const v = document.createElement('video');
    v.src = src;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.setAttribute('muted', '');
    // Upload only when the decoder has a new frame (24 fps), not every render (60+ fps)
    const onFrame = () => {
      tex.fresh = true;
      if (!this.disposed) v.requestVideoFrameCallback(onFrame);
    };
    v.addEventListener(
      'canplay',
      () => {
        tex.video = v;
        tex.w = v.videoWidth || tex.w;
        tex.h = v.videoHeight || tex.h;
        if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(onFrame);
        v.play().catch(() => {});
      },
      { once: true },
    );
  }

  /** Flies to a scene. The first call cuts straight in. */
  async show(index: number, instant = false) {
    if (this.hasScene && index === this.to && this.mix >= 1) return;
    const tex = await this.load(index);
    if (!tex || this.disposed) return;
    if (instant || !this.hasScene || this.intensity === 0) {
      this.hasScene = true;
      this.from = index;
      this.to = index;
      this.mix = 1;
    } else {
      // If a transition is mid-flight, continue from wherever the picture is now
      this.from = this.mix > 0.5 ? this.to : this.from;
      this.to = index;
      this.mix = 0;
      this.mixStart = performance.now();
    }
    this.onReady?.();
    this.load(index + 1);
  }

  setPointer(x: number, y: number) {
    this.pointerTarget = [x, y];
  }

  setDolly(p: number) {
    this.dollyTarget = p;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 800 ? 1.5 : 1.75);
    const w = Math.round(this.canvas.clientWidth * dpr);
    const h = Math.round(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }

  play() {
    if (this.running || this.disposed) return;
    this.running = true;
    const tick = (now: number) => {
      if (!this.running) return;
      this.frame(now);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    for (const t of this.textures.values()) t.video?.pause();
  }

  private bind(unit: number, tex: WebGLTexture) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  private frame(now: number) {
    const gl = this.gl;
    const a = this.textures.get(this.scenes[this.from]?.id);
    const b = this.textures.get(this.scenes[this.to]?.id);
    if (!a || !b) return;

    if (this.mix < 1) {
      const t = Math.min(1, (now - this.mixStart) / 1400);
      this.mix = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      if (t >= 1) {
        this.mix = 1;
        this.from = this.to;
      }
    }
    const k = 0.06;
    this.pointer[0] += (this.pointerTarget[0] - this.pointer[0]) * k;
    this.pointer[1] += (this.pointerTarget[1] - this.pointer[1]) * k;
    this.dolly += (this.dollyTarget - this.dolly) * 0.08;

    for (const t of a === b ? [a] : [a, b]) {
      const v = t.video;
      if (!v || v.readyState < 2) continue;
      if (v.paused) v.play().catch(() => {});
      const due = 'requestVideoFrameCallback' in v ? t.fresh : now - (t.uploadedAt ?? 0) > 40;
      if (due) {
        gl.bindTexture(gl.TEXTURE_2D, t.img);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
        t.fresh = false;
        t.uploadedAt = now;
      }
    }
    // Scenes that are off stage don't need their video decoding
    for (const [id, t] of this.textures) {
      if (t.video && !t.video.paused && id !== this.scenes[this.from]?.id && id !== this.scenes[this.to]?.id) t.video.pause();
    }

    const sa = this.scenes[this.from];
    const sb = this.scenes[this.to];
    this.bind(0, a.img);
    this.bind(1, a.dep);
    this.bind(2, b.img);
    this.bind(3, b.dep);
    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.u.uSizeA, a.w, a.h);
    gl.uniform2f(this.u.uSizeB, b.w, b.h);
    gl.uniform2f(this.u.uFocusA, ...sa.focus);
    gl.uniform2f(this.u.uFocusB, ...sb.focus);
    gl.uniform3f(this.u.uGradeA, ...(sa.grade ?? [1, 0, 1]));
    gl.uniform3f(this.u.uGradeB, ...(sb.grade ?? [1, 0, 1]));
    gl.uniform1f(this.u.uMix, this.from === this.to ? 1 : this.mix);
    gl.uniform1f(this.u.uTime, this.intensity ? (now - this.start) / 1000 : 0);
    gl.uniform1f(this.u.uDolly, this.dolly * this.intensity);
    gl.uniform1f(this.u.uIntensity, this.intensity);
    gl.uniform1f(this.u.uClouds, this.intensity);
    gl.uniform2f(this.u.uPointer, this.pointer[0], this.pointer[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    this.pause();
    this.disposed = true;
    for (const t of this.textures.values()) {
      this.gl.deleteTexture(t.img);
      this.gl.deleteTexture(t.dep);
      t.video?.removeAttribute('src');
    }
    this.textures.clear();
    // Free GPU objects but keep the context alive: the same canvas may be
    // handed to a new stage (React remounts effects in development).
    this.gl.deleteProgram(this.prog);
  }
}
