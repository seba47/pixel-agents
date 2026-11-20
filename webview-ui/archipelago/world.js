// The world: sky, sea (or a sea of clouds), islands with their terrain, the
// bridges between them, lights, and ground height for anything that walks.
import * as THREE from './three.js';

export function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 2D value noise in [0, 1]. */
export function noise2(seed) {
  const r = rng(seed);
  const T = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) T[i] = r();
  const h = (x, y) => T[((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) & 1023];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi);
    const b = h(xi + 1, yi);
    const c = h(xi, yi + 1);
    const d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

const smooth = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

const COMMON_GLSL = /* glsl */ `
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1, 0)), u.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
`;

// ── Sky ───────────────────────────────────────────────────────────────────
function makeSky(pal) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(pal.skyTop) },
      mid: { value: new THREE.Color(pal.skyMid) },
      horizon: { value: new THREE.Color(pal.horizon) },
      sunColor: { value: new THREE.Color(pal.sunDisc) },
      sunDir: { value: pal.sunDir.clone().normalize() },
      sunSize: { value: pal.sunSize ?? 0.0012 },
      stars: { value: pal.stars ?? 0 },
      clouds: { value: pal.skyClouds ?? 0.0 },
      cloudColor: { value: new THREE.Color(pal.cloudColor ?? '#ffffff') },
      time: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 sunColor; uniform vec3 sunDir;
      uniform float sunSize; uniform float stars; uniform float time; uniform float clouds; uniform vec3 cloudColor;
      varying vec3 vDir;
      ${COMMON_GLSL}
      float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
        col = mix(col, top, smoothstep(0.2, 0.8, h));
        col = mix(col, horizon * 0.8, 1.0 - smoothstep(-0.25, 0.0, h));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * (smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.5, s) * 2.0 + pow(s, 10.0) * 0.35 + pow(s, 90.0) * 0.5);
        if (stars > 0.0) {
          vec3 q = floor(d * 520.0); float n = hash3(q);
          float tw = 0.55 + 0.45 * sin(time * 2.0 + n * 60.0);
          col += vec3(step(0.9978, n) * stars * tw * smoothstep(0.03, 0.35, h));
        }
        if (clouds > 0.0 && h > 0.0) {
          vec2 uv = d.xz / (h + 0.12) * 1.4 + vec2(time * 0.006, 0.0);
          float c = smoothstep(0.5, 0.85, fbm(uv * 1.3)) * smoothstep(0.0, 0.25, h) * clouds;
          vec3 lit = mix(cloudColor, sunColor, pow(s, 6.0) * 0.6);
          col = mix(col, lit, c * 0.85);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
  mesh.renderOrder = -1;
  return mesh;
}

// ── Sea ───────────────────────────────────────────────────────────────────
function makeSea(pal, islands) {
  const isl = Array.from({ length: 12 }, (_, i) =>
    islands[i]
      ? new THREE.Vector4(islands[i].x, islands[i].z, islands[i].shore, 0)
      : new THREE.Vector4(9999, 9999, 0, 0),
  );
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      deep: { value: new THREE.Color(pal.deep) },
      shallow: { value: new THREE.Color(pal.shallow) },
      foamColor: { value: new THREE.Color(pal.foam ?? '#ffffff') },
      skyColor: { value: new THREE.Color(pal.waterSky ?? pal.horizon) },
      sunDir: { value: pal.sunDir.clone().normalize() },
      sunColor: { value: new THREE.Color(pal.sunGlint ?? pal.sunDisc) },
      fogColor: { value: new THREE.Color(pal.fog) },
      fogDensity: { value: pal.fogDensity },
      islands: { value: isl },
      ripple: { value: pal.ripple ?? 0.22 },
      foamAmount: { value: pal.foamAmount ?? 0.85 },
    },
    vertexShader: /* glsl */ `
      uniform float time; varying vec3 vPos; varying vec3 vN;
      float H(vec2 p) {
        return 0.16 * sin(p.x * 0.30 + time * 1.05) + 0.11 * sin(p.y * 0.42 + time * 0.8)
             + 0.05 * sin((p.x + p.y) * 0.9 + time * 1.9) + 0.03 * sin((p.x - p.y) * 1.7 + time * 2.4);
      }
      void main() {
        vec3 pos = (modelMatrix * vec4(position, 1.0)).xyz;
        float e = 0.2; float h = H(pos.xz);
        vN = normalize(vec3(h - H(pos.xz + vec2(e, 0.0)), e, h - H(pos.xz + vec2(0.0, e))));
        pos.y += h; vPos = pos;
        gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float time; uniform vec3 deep; uniform vec3 shallow; uniform vec3 foamColor; uniform vec3 skyColor;
      uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 fogColor; uniform float fogDensity; uniform vec4 islands[12];
      uniform float ripple; uniform float foamAmount;
      varying vec3 vPos; varying vec3 vN;
      ${COMMON_GLSL}
      void main() {
        float d = 1e4;
        for (int i = 0; i < 12; i++) d = min(d, length(vPos.xz - islands[i].xy) - islands[i].z);
        vec2 q = vPos.xz;
        vec3 N = normalize(vN + vec3(vnoise(q * 0.9 + time * 0.35) - 0.5, 0.0, vnoise(q * 0.9 - time * 0.3 + 7.0) - 0.5) * 0.35);
        vec3 V = normalize(cameraPosition - vPos);
        float sh = 1.0 - smoothstep(0.0, 8.0, d);
        vec3 col = mix(deep, shallow, pow(sh, 1.4));
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        col = mix(col, skyColor, fres * 0.6);
        vec3 L = normalize(sunDir); vec3 Hh = normalize(L + V);
        float spec = pow(max(dot(N, Hh), 0.0), 220.0);
        col += sunColor * spec * 2.4;
        float n = vnoise(q * 1.4 + vec2(time * 0.45, -time * 0.3));
        float foam = (1.0 - smoothstep(0.0, 1.3, d + n * 1.0)) * (0.7 + 0.3 * sin(time * 2.0 - d * 3.0));
        foam += smoothstep(0.8, 0.95, vnoise(q * 2.2 + time * 0.2)) * sh * 0.2;
        // Soft ripples travelling out from each shore.
        foam += (1.0 - smoothstep(0.5, 9.0, d)) * smoothstep(0.93, 1.0, sin(d * 1.8 - time * 1.1)) * ripple;
        col = mix(col, foamColor, clamp(foam, 0.0, 1.0) * foamAmount);
        float dist = length(vPos - cameraPosition);
        col = mix(col, fogColor, 1.0 - exp(-pow(fogDensity * dist, 2.0)));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geo = new THREE.PlaneGeometry(700, 700, 260, 260);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  return mesh;
}

/** A sea of clouds far below floating islands. */
function makeCloudSea(pal) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      low: { value: new THREE.Color(pal.cloudLow) },
      high: { value: new THREE.Color(pal.cloudHigh) },
      rim: { value: new THREE.Color(pal.sunDisc) },
      sunDir: { value: pal.sunDir.clone().normalize() },
      fogColor: { value: new THREE.Color(pal.fog) },
      fogDensity: { value: pal.fogDensity },
    },
    vertexShader: /* glsl */ `
      uniform float time; varying vec3 vPos; varying float vH;
      ${COMMON_GLSL}
      void main() {
        vec3 pos = (modelMatrix * vec4(position, 1.0)).xyz;
        float h = fbm(pos.xz * 0.035 + vec2(time * 0.01, time * 0.006));
        pos.y += h * 9.0; vH = h; vPos = pos;
        gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float time; uniform vec3 low; uniform vec3 high; uniform vec3 rim; uniform vec3 sunDir;
      uniform vec3 fogColor; uniform float fogDensity; varying vec3 vPos; varying float vH;
      ${COMMON_GLSL}
      void main() {
        float d = fbm(vPos.xz * 0.12 + time * 0.02);
        vec3 col = mix(low, high, smoothstep(0.3, 0.75, vH + d * 0.25));
        col += rim * smoothstep(0.6, 0.85, vH) * 0.25;
        float dist = length(vPos - cameraPosition);
        col = mix(col, fogColor, 1.0 - exp(-pow(fogDensity * dist, 2.0)));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const geo = new THREE.PlaneGeometry(700, 700, 200, 200);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = pal.cloudY ?? -26;
  return m;
}

// ── Islands ───────────────────────────────────────────────────────────────
/**
 * A low-poly island on a polar grid: a plateau of grass, a sand beach, rock on
 * the slopes. `floating` grows a rocky underside instead of a sea shelf.
 */
export function makeIsland(opt) {
  const { x, z, r, h, seed = 1, pal, floating = false, beach = 0.35 } = opt;
  const n = noise2(seed);
  const warp = (a) =>
    1 + 0.22 * (n(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6 + seed * 0.5) - 0.5) * 2;
  const reach = floating ? 1.0 : 1.35;
  const hf = (wx, wz) => {
    const dx = wx - x;
    const dz = wz - z;
    const dn = Math.hypot(dx, dz) / (r * warp(Math.atan2(dz, dx)));
    if (floating) {
      if (dn > 1.0) return -Infinity;
      const s = smooth(1.0, 0.75, dn);
      return 0.3 * s + (h - 0.3) * smooth(0.95, 0.35, dn) + (n(wx * 0.3, wz * 0.3) - 0.5) * 0.6 * s;
    }
    const s = smooth(1.05, 0.5, dn);
    const bumps =
      (n(wx * 0.28, wz * 0.28) - 0.5) * 1.3 * s * s + (n(wx * 0.9, wz * 0.9) - 0.5) * 0.25 * s;
    return -2.4 + (h + 2.4) * s + bumps;
  };
  const RINGS = 30;
  const SEGS = 96;
  const pos = [];
  const col = [];
  const rimPts = [];
  const vtx = (i, j) => {
    const a = (j / SEGS) * Math.PI * 2;
    const rad = (i / RINGS) * r * reach * warp(a);
    const wx = x + Math.cos(a) * rad;
    const wz = z + Math.sin(a) * rad;
    let wy = hf(wx, wz);
    if (!Number.isFinite(wy)) wy = 0.3;
    return [wx, wy, wz];
  };
  const grid = [];
  for (let i = 0; i <= RINGS; i++) {
    grid.push([]);
    for (let j = 0; j <= SEGS; j++) grid[i].push(vtx(i, j % SEGS));
  }
  for (let j = 0; j < SEGS; j++) rimPts.push(grid[RINGS][j]);
  const cr = rng(seed + 9);
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const face = (A, B, C) => {
    const ay = (A[1] + B[1] + C[1]) / 3;
    if (!floating && A[1] < -2.3 && B[1] < -2.3 && C[1] < -2.3) return;
    tmp.set(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    tmp2.set(C[0] - A[0], C[1] - A[1], C[2] - A[2]);
    nrm.crossVectors(tmp, tmp2).normalize();
    // Wind every face upward (three.js fronts are counter-clockwise).
    const order = nrm.y >= 0 ? [A, B, C] : [A, C, B];
    if (nrm.y < 0) nrm.negate();
    let c;
    if (ay < (floating ? -1 : beach)) c = ay < -0.4 ? pal.sandWet : pal.sand;
    else if (nrm.y < 0.8) c = pal.rock;
    else if (ay > h - 0.45 && cr() < 0.5) c = pal.grassLight;
    else c = pal.grass;
    const base = new THREE.Color(c);
    base.offsetHSL(0, 0, (cr() - 0.5) * 0.05);
    for (const P of order) {
      pos.push(P[0], P[1], P[2]);
      col.push(base.r, base.g, base.b);
    }
  };
  for (let i = 0; i < RINGS; i++)
    for (let j = 0; j < SEGS; j++) {
      const a = grid[i][j];
      const b = grid[i][j + 1];
      const c = grid[i + 1][j];
      const d = grid[i + 1][j + 1];
      if (i === 0) face(a, c, d);
      else {
        face(a, c, d);
        face(a, d, b);
      }
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.95,
  });
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  group.add(mesh);
  if (floating) group.add(makeUnderside(rimPts, x, z, r, seed, pal));
  return { group, hf, x, z, r, h, shore: r * 1.02, floating, rim: rimPts };
}

/** The rock cone under a floating island, ending in a jagged point. */
function makeUnderside(rim, x, z, r, seed, pal) {
  const n = noise2(seed + 3);
  const depth = r * 1.5;
  const K = 9;
  const pos = [];
  const col = [];
  const rows = [];
  for (let k = 0; k <= K; k++) {
    const t = k / K;
    rows.push(
      rim.map(([rx, ry, rz], j) => {
        const f = Math.pow(1 - t, 1.25) * (0.85 + 0.3 * n(j * 0.4, k * 0.7));
        const y = ry - t * depth * (0.8 + 0.4 * n(j * 0.2 + 5, k));
        return [x + (rx - x) * f, k === 0 ? ry : y, z + (rz - z) * f];
      }),
    );
  }
  const cr = rng(seed);
  const S = rim.length;
  for (let k = 0; k < K; k++) {
    const c = new THREE.Color(pal.rockDark).lerp(new THREE.Color(pal.rock), 1 - k / K);
    for (let j = 0; j < S; j++) {
      const a = rows[k][j];
      const b = rows[k][(j + 1) % S];
      const cc = rows[k + 1][j];
      const d = rows[k + 1][(j + 1) % S];
      for (const tri of [
        [a, b, cc],
        [b, d, cc],
      ]) {
        const shade = c.clone().offsetHSL(0, 0, (cr() - 0.5) * 0.06);
        for (const P of tri) {
          pos.push(...P);
          col.push(shade.r, shade.g, shade.b);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  m.castShadow = true;
  return m;
}

// ── The world container ───────────────────────────────────────────────────
export class World {
  constructor(scene, pal) {
    this.scene = scene;
    this.pal = pal;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.islands = [];
    this.bridges = [];
    this.updaters = [];
  }
  addIsland(opt) {
    const isl = makeIsland({ ...opt, pal: this.pal.land });
    this.islands.push(isl);
    this.root.add(isl.group);
    return isl;
  }
  /** A walkable span from A to B (world xz), sagging by `sag`. */
  addSpan(a, b, sag, lift = 0.15) {
    const ya = this.groundY(a[0], a[1]);
    const yb = this.groundY(b[0], b[1]);
    const span = { a, b, ya: ya + lift, yb: yb + lift, sag };
    this.bridges.push(span);
    return span;
  }
  spanY(s, t) {
    return s.ya + (s.yb - s.ya) * t - Math.sin(Math.PI * t) * s.sag;
  }
  groundY(x, z) {
    let best = -Infinity;
    for (const isl of this.islands) best = Math.max(best, isl.hf(x, z));
    for (const s of this.bridges) {
      const [ax, az] = s.a;
      const [bx, bz] = s.b;
      const dx = bx - ax;
      const dz = bz - az;
      const L2 = dx * dx + dz * dz;
      const t = ((x - ax) * dx + (z - az) * dz) / L2;
      if (t < 0 || t > 1) continue;
      const px = ax + dx * t;
      const pz = az + dz * t;
      if (Math.hypot(x - px, z - pz) < 0.9) best = Math.max(best, this.spanY(s, t));
    }
    return Number.isFinite(best) ? best : 0;
  }
  onUpdate(fn) {
    this.updaters.push(fn);
  }
  update(t, dt) {
    for (const f of this.updaters) f(t, dt);
  }
  /** Sky, sea/clouds and lights, once the islands are known. */
  finish() {
    const pal = this.pal;
    const sky = makeSky(pal);
    this.root.add(sky);
    const sea = pal.cloudLow ? makeCloudSea(pal) : makeSea(pal, this.islands);
    this.root.add(sea);
    this.onUpdate((t) => {
      sky.material.uniforms.time.value = t;
      sea.material.uniforms.time.value = t;
    });
    const sun = new THREE.DirectionalLight(pal.sunLight, pal.sunIntensity);
    sun.position.copy(pal.sunDir.clone().normalize().multiplyScalar(80));
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -60;
    sc.right = 60;
    sc.top = 45;
    sc.bottom = -45;
    sc.near = 1;
    sc.far = 220;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.root.add(sun);
    this.root.add(new THREE.HemisphereLight(pal.hemiSky, pal.hemiGround, pal.hemiIntensity));
    this.scene.fog = new THREE.FogExp2(pal.fog, pal.fogDensity);
    this.scene.background = new THREE.Color(pal.fog);
  }
  dispose() {
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
  }
}
