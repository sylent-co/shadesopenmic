// Camera maths mirrored by the landscape shader so 2D overlays can be placed
// on 3D directions (sun, water points) precisely.

export function cameraBasis(yaw, pitch, roll = 0) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const f = [Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp];
  // right = normalize(cross(up, f))
  let r = [f[2], 0, -f[0]];
  const rl = Math.hypot(r[0], r[2]) || 1;
  r = [r[0] / rl, 0, r[2] / rl];
  // up = cross(f, r)
  let u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
  if (roll) {
    const c = Math.cos(roll), s = Math.sin(roll);
    const r2 = [r[0] * c + u[0] * s, r[1] * c + u[1] * s, r[2] * c + u[2] * s];
    const u2 = [u[0] * c - r[0] * s, u[1] * c - r[1] * s, u[2] * c - r[2] * s];
    r = r2; u = u2;
  }
  return { f, r, u };
}

export const dirFromAngles = (az, el) => [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Project a world direction to canvas pixels. Returns null when behind camera. */
export function projectDir(cam, d, W, H) {
  const z = dot(d, cam.f);
  if (z <= 1e-5) return null;
  const x = dot(d, cam.r) / z / (2 * cam.tanHalf);
  const y = dot(d, cam.u) / z / (2 * cam.tanHalf);
  return { x: W / 2 + x * H, y: H / 2 - y * H, z };
}

/** Project a world point. */
export function projectPoint(cam, p, W, H) {
  const d = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]];
  return projectDir(cam, d, W, H);
}
