/**
 * The network orb's geometry (pure, DOM-free): where each agent sits on the
 * globe and how a point on the globe lands on the orb's pixel grid.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface OrbPoint {
  /** Orb pixel column / row (integers). */
  px: number;
  py: number;
  /** Depth toward the viewer: > 0 is the front half of the globe. */
  depth: number;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * The i-th of n points spread evenly over the unit sphere (a Fibonacci
 * lattice), kept off the poles so no node hides at the top or bottom.
 */
export function nodePosition(i: number, n: number): Vec3 {
  const count = Math.max(n, 1);
  // Latitude band [-0.75, 0.75] instead of [-1, 1]: nodes stay near the face.
  const y = count === 1 ? 0 : 0.75 - (1.5 * i) / (count - 1);
  const r = Math.sqrt(1 - y * y);
  const theta = GOLDEN_ANGLE * i;
  return { x: Math.cos(theta) * r, y, z: Math.sin(theta) * r };
}

/** A point at (latitude, longitude) on the unit sphere. */
export function latLon(lat: number, lon: number): Vec3 {
  return { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) };
}

/**
 * Spin the globe by `spin` around its vertical axis, tilt it toward the viewer
 * by `tilt`, and project it orthographically onto a `size`-pixel orb.
 */
export function projectOnOrb(p: Vec3, spin: number, tilt: number, size: number): OrbPoint {
  // Spin around Y.
  const cs = Math.cos(spin);
  const sn = Math.sin(spin);
  const x1 = p.x * cs - p.z * sn;
  const z1 = p.x * sn + p.z * cs;
  // Tilt around X.
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const y2 = p.y * ct - z1 * st;
  const z2 = p.y * st + z1 * ct;
  const radius = size / 2 - 3;
  const centre = size / 2;
  return {
    px: Math.round(centre + x1 * radius),
    py: Math.round(centre - y2 * radius),
    depth: z2,
  };
}

/** Integer points of a straight line (Bresenham), both ends included. */
export function linePixels(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    points.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}
