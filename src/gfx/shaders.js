// GLSL sources. All lighting happens in linear space; the grade pass converts
// to display space.

const COMMON = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 fragColor;
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise1(float x) { float i = floor(x); float f = fract(x); float u = f * f * (3.0 - 2.0 * f); return mix(hash11(i), hash11(i + 1.0), u); }
float vnoise2(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm2(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise2(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p + 11.7; a *= 0.5; }
  return s / 0.9375;
}
`;

export const LANDSCAPE = COMMON + `
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uCamF;
uniform vec3 uCamR;
uniform vec3 uCamU;
uniform float uTanHalf;
uniform vec2 uJitter;
uniform vec3 uSunDir;
uniform float uSunRad;
uniform float uNight;
uniform vec4 uDrop;      // impact x, z, time, strength
uniform float uWind;
uniform float uFocus;
uniform float uBrand;
uniform float uMark;
uniform float uMarkSweep;
uniform sampler2D uMarkTex;
uniform float uCalm;
uniform float uExposure;
uniform float uStorm;      // overcast monsoon sky
uniform float uRain;       // rain ripples on the water
uniform float uLightning;  // sky flash
uniform float uDawn;       // dawn palette instead of golden hour
uniform float uMist;       // valley mist
uniform float uSunVis;     // sun disc visibility

float PX; // angular size of one pixel (radians)

float ridge(float a, float freq, float seed, float sharp) {
  float s = 0.0, amp = 0.5, n = 0.0, f = freq;
  for (int i = 0; i < 5; i++) {
    float v = vnoise1(a * f + seed + float(i) * 17.3);
    v = mix(v, 1.0 - abs(v * 2.0 - 1.0), sharp);
    s += amp * v; n += amp;
    f *= 2.13; amp *= 0.48;
  }
  return s / n;
}

// Colour model fitted to the SHADES logo artwork (lp: disc coords, y up, radius 1).
vec3 brandDisc(vec2 lp) {
  float r = length(lp);
  float y = lp.y;
  float base = y < 0.0 ? 200.0 - 30.0 * y : 200.0 - 115.0 * pow(y, 1.1);
  base *= 1.0 - 0.45 * pow(abs(lp.x), 1.5);
  float R = base / 255.0;
  vec3 c = vec3(R, R * (0.10 + 0.06 * base / 230.0), R * (0.02 + 0.045 * base / 230.0));
  float rim = smoothstep(0.945, 0.985, r);
  c = mix(c, vec3(0.90, 0.115, 0.03), rim * 0.85);
  return lin(c);
}

vec2 sunLocal(vec3 rd) {
  vec3 sr = normalize(cross(vec3(0.0, 1.0, 0.0), uSunDir));
  vec3 su = cross(uSunDir, sr);
  return vec2(dot(rd, sr), dot(rd, su)) / uSunRad;
}

// sky palette (linear)
vec3 C_HOR, C_LOW, C_MID, C_HIGH, C_ZEN;

vec3 skyGradient(float h, float azSun, float sunDot) {
  vec3 sky = mix(C_HOR, C_LOW, smoothstep(0.0, 0.045, h));
  sky = mix(sky, C_MID, smoothstep(0.03, 0.15, h));
  sky = mix(sky, C_HIGH, smoothstep(0.12, 0.34, h));
  sky = mix(sky, C_ZEN, smoothstep(0.28, 0.85, h));
  float sv = uSunVis * (1.0 - uStorm);
  sky += mix(lin(vec3(1.0, 0.56, 0.30)), lin(vec3(1.0, 0.62, 0.52)), uDawn) * exp(-h * 14.0) * pow(azSun, 4.0) * 0.45 * sv;
  sky += mix(lin(vec3(1.0, 0.58, 0.32)), lin(vec3(1.0, 0.72, 0.50)), uDawn) * (pow(sunDot, 8.0) * 0.16 + pow(sunDot, 60.0) * 0.32 + pow(sunDot, 600.0) * 0.75) * (1.0 - 0.85 * uBrand * (1.0 - uNight)) * sv;
  vec3 ssky = mix(lin(vec3(0.40, 0.45, 0.50)), lin(vec3(0.20, 0.24, 0.29)), smoothstep(0.0, 0.22, h));
  ssky = mix(ssky, lin(vec3(0.08, 0.10, 0.13)), smoothstep(0.18, 0.8, h));
  ssky += lin(vec3(0.75, 0.82, 1.0)) * uLightning * (0.35 + 0.65 * smoothstep(0.0, 0.4, h));
  sky = mix(sky, ssky, uStorm);
  vec3 nsky = mix(lin(vec3(0.045, 0.040, 0.085)), lin(vec3(0.020, 0.024, 0.062)), smoothstep(0.0, 0.10, h));
  nsky = mix(nsky, lin(vec3(0.006, 0.008, 0.024)), smoothstep(0.08, 0.60, h));
  nsky += lin(vec3(0.95, 0.10, 0.04)) * (pow(sunDot, 14.0) * 0.025 + pow(sunDot, 160.0) * 0.10) * uBrand;
  return mix(sky, nsky, uNight);
}

vec3 env(vec3 rd, bool reflected) {
  float e = rd.y;
  float h = max(e, 0.0);
  float sunDot = max(dot(rd, uSunDir), 0.0);
  vec2 hz = rd.xz / max(length(rd.xz), 1e-4);
  float azSun = max(dot(hz, normalize(uSunDir.xz)), 0.0);
  vec3 sky = skyGradient(h, azSun, sunDot);

  // clouds: thin streaks, lit from the sun side
  if (e > 0.012) {
    vec2 cp = rd.xz / (e + 0.06);
    cp = cp * vec2(0.55, 1.9) + vec2(uTime * 0.018, 0.0);
    float n = fbm2(cp * 1.3);
    float band = smoothstep(0.012, 0.05, e) * (1.0 - smoothstep(0.22, 0.48, e));
    float dens = smoothstep(0.52, 0.80, n) * band;
    vec3 lit = mix(lin(vec3(0.42, 0.33, 0.50)), lin(vec3(1.0, 0.64, 0.42)), pow(azSun, 3.0) * smoothstep(0.35, 0.0, e));
    lit += lin(vec3(1.0, 0.72, 0.48)) * pow(sunDot, 30.0) * 1.2;
    vec3 nlit = lin(vec3(0.05, 0.05, 0.08)) + lin(vec3(0.45, 0.05, 0.03)) * pow(sunDot, 40.0) * uBrand * 0.35;
    sky = mix(sky, mix(lit, nlit, uNight), dens * 0.7 * (1.0 - uStorm));
  }
  if (uStorm > 0.0 && e > -0.02) {
    vec2 cp = rd.xz / (max(e, 0.0) + 0.09) * 0.55 + vec2(uTime * 0.09, uTime * 0.02);
    float n = fbm2(cp) * 0.65 + fbm2(cp * 2.7 + 5.0) * 0.35;
    float dens = smoothstep(0.30, 0.72, n);
    vec3 under = lin(vec3(0.10, 0.12, 0.15)), top = lin(vec3(0.36, 0.40, 0.46));
    vec3 cc = mix(under, top, smoothstep(0.35, 0.95, n));
    cc += lin(vec3(0.80, 0.86, 1.0)) * uLightning * (0.6 + 1.6 * dens);
    sky = mix(sky, cc, dens * uStorm * smoothstep(-0.02, 0.03, e) * 0.92);
  }

  // stars
  {
    vec2 sp = vec2(atan(rd.x, rd.z), asin(clamp(e, -1.0, 1.0))) * 150.0;
    vec2 id = floor(sp); vec2 f = fract(sp) - 0.5;
    float hs = hash12(id);
    if (hs > 0.968) {
      vec2 off = hash22(id) - 0.5;
      float d = length(f - off * 0.6);
      float tw = 0.65 + 0.35 * sin(uTime * (1.5 + hs * 6.0) + hs * 50.0);
      float st = smoothstep(0.16, 0.0, d) * (hs - 0.968) / 0.032 * tw;
      float vis = mix(smoothstep(0.26, 0.7, e) * 0.45, smoothstep(0.02, 0.2, e) * 1.2, uNight);
      sky += vec3(1.0, 0.95, 0.9) * st * vis * 1.5 * (1.0 - uStorm);
    }
  }

  // sun disc (a crisp hazy-orange ball that morphs into the brand disc)
  vec2 lp = sunLocal(rd);
  float dsun = length(lp);
  float pxs = PX / uSunRad * (reflected ? 2.0 : 1.0);
  float disc = smoothstep(1.0 + pxs, 1.0 - pxs, dsun) * step(0.0, dot(rd, uSunDir)) * uSunVis * (1.0 - uStorm);
  if (disc > 0.0) {
    vec3 golden = mix(lin(vec3(1.0, 0.62, 0.30)), lin(vec3(1.0, 0.74, 0.46)), uDawn) * 2.6 * mix(1.0, 0.74, pow(dsun, 2.0));
    golden = mix(golden, lin(vec3(1.0, 0.38, 0.15)) * 2.1, smoothstep(0.5, 1.0, dsun) * 0.65);
    vec3 brand = brandDisc(lp) * mix(1.12, 1.0, uNight);
    if (uMark > 0.0) {
      float m = texture(uMarkTex, lp * 0.5 + 0.5).a;
      float sc = (lp.x * 0.55 - lp.y) * 0.36 + 0.5;
      float rev = 1.0 - smoothstep(uMarkSweep - 0.08, uMarkSweep, sc);
      float edge = exp(-pow((sc - uMarkSweep) / 0.04, 2.0)) * smoothstep(-0.1, 0.05, uMarkSweep) * (1.0 - smoothstep(1.0, 1.15, uMarkSweep));
      brand = mix(brand, vec3(1.02), m * rev * uMark);
      brand += vec3(1.0, 0.62, 0.48) * m * edge * 2.0 * uMark;
    }
    sky = mix(sky, mix(golden, brand, uBrand), disc);
  }

  // mountain layers, far to near (elevations in radians)
  float a = atan(rd.x, rd.z);
  float px = PX * (reflected ? 2.5 : 1.0);
  vec3 hazeCol = mix(mix(C_HOR, C_LOW, 0.55), lin(vec3(0.06, 0.04, 0.07)), uNight);
  float glowSide = pow(azSun, 3.0);

  float h0 = 0.014 + 0.12 * pow(ridge(a, 1.7, 3.0, 0.85), 1.8);
  float m0 = smoothstep(h0 + px, h0 - px, e);
  vec3 c0 = mix(sky, mix(lin(vec3(0.66, 0.50, 0.64)), lin(vec3(0.05, 0.035, 0.06)), uNight), 0.62);
  c0 += mix(lin(vec3(1.0, 0.66, 0.55)), lin(vec3(0.5, 0.05, 0.02)) * uBrand * 0.25, uNight) * 0.22 * smoothstep(h0 - 0.02, h0, e) * (0.35 + glowSide);
  c0 = mix(c0, hazeCol, exp(-(e - 0.01) * 60.0) * 0.35);
  sky = mix(sky, c0, m0 * 0.8);

  float h1 = 0.008 + 0.05 * ridge(a, 2.9, 41.0, 0.3);
  float m1 = smoothstep(h1 + px, h1 - px, e);
  vec3 c1 = mix(mix(lin(vec3(0.47, 0.31, 0.45)), hazeCol, 0.35), lin(vec3(0.04, 0.028, 0.05)), uNight);
  c1 = mix(c1, hazeCol, exp(-(e - 0.004) * 90.0) * 0.5);
  c1 += mix(lin(vec3(1.0, 0.6, 0.4)), lin(vec3(0.9, 0.1, 0.04)) * uBrand * 0.25, uNight) * exp(-abs(h1 - e) / (px * 2.5 + 0.0015)) * 0.3 * glowSide;
  sky = mix(sky, c1, m1);

  float h2 = 0.004 + 0.032 * ridge(a, 4.8, 77.0, 0.15);
  float m2 = smoothstep(h2 + px, h2 - px, e);
  vec3 c2 = mix(lin(vec3(0.25, 0.15, 0.26)), lin(vec3(0.022, 0.016, 0.03)), uNight);
  c2 = mix(c2, hazeCol, exp(-(e - 0.002) * 140.0) * 0.45);
  c2 += mix(lin(vec3(1.0, 0.55, 0.35)), lin(vec3(0.8, 0.08, 0.03)) * uBrand * 0.25, uNight) * exp(-abs(h2 - e) / (px * 2.0 + 0.001)) * 0.28 * glowSide;
  sky = mix(sky, c2, m2);

  float trees = pow(vnoise1(a * 140.0 + 5.0), 2.0) * 0.0045 + pow(vnoise1(a * 320.0), 3.0) * 0.002;
  float h3 = 0.001 + 0.008 * ridge(a, 9.0, 131.0, 0.0) + trees;
  float m3 = smoothstep(h3 + px, h3 - px, e);
  vec3 c3 = mix(lin(vec3(0.075, 0.05, 0.095)), lin(vec3(0.010, 0.008, 0.016)), uNight);
  c3 += mix(lin(vec3(0.9, 0.45, 0.28)), lin(vec3(0.6, 0.05, 0.02)) * uBrand * 0.25, uNight) * exp(-abs(h3 - e) / (px * 1.5 + 0.0006)) * 0.22 * glowSide;
  sky = mix(sky, c3, m3);

  if (uStorm > 0.0) {
    float mAny = max(max(m0, m1), max(m2, m3));
    sky = mix(sky, lin(vec3(0.21, 0.24, 0.28)) * (1.0 + 1.5 * uLightning), uStorm * mAny * 0.8);
  }
  float mist = exp(-max(e, 0.0) * mix(260.0, 70.0, uMist)) * (0.3 + 0.25 * vnoise2(vec2(a * 30.0 + uTime * 0.05, 1.0)) + 0.35 * uMist);
  sky = mix(sky, mix(hazeCol * 1.05, mix(C_HOR, vec3(0.9), 0.3), uMist * (1.0 - uNight)), clamp(mist, 0.0, 1.0) * (1.0 - uNight * 0.6));
  if (uStorm > 0.0) {
    vec3 veil = mix(lin(vec3(0.34, 0.38, 0.43)), lin(vec3(0.72, 0.78, 0.95)), uLightning * 0.6);
    sky = mix(sky, veil, uStorm * exp(-max(e, 0.0) * 16.0) * 0.82);
  }
  return sky;
}

float gAmp(float k, float footprint) { return exp(-k * footprint * 0.6); }

vec3 waterNormal(vec2 p, float footprint, out float ringGlow) {
  float t = uTime;
  vec2 g = vec2(0.0);
  float calm = mix(1.0, 0.35, uCalm);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float ang = 0.35 + fi * 1.83;
    vec2 dir = vec2(cos(ang), sin(ang));
    float k = 1.6 * pow(1.62, fi);
    float w = sqrt(9.8 * k) * 0.42;
    float A = 0.018 / pow(1.75, fi) * calm;
    float ph = dot(dir, p) * k - w * t + fi * 2.7;
    g += dir * (A * k * cos(ph)) * gAmp(k, footprint);
  }
  vec2 wdir = normalize(vec2(1.0, 0.35));
  float gust = smoothstep(0.35, 0.85, vnoise2(p * 0.22 - wdir * t * 0.9));
  float windAmt = (0.25 + uWind * (0.6 + 1.4 * gust)) * calm + uStorm * 0.8;
  vec2 q = p * 3.5 - wdir * t * 1.6;
  float e0 = 0.08;
  for (int o = 0; o < 2; o++) {
    float k = 3.5 * pow(2.3, float(o)) * 6.28;
    float amp = 0.0045 / pow(2.0, float(o)) * windAmt * gAmp(k, footprint);
    float n0 = vnoise2(q), nx = vnoise2(q + vec2(e0, 0.0)), nz = vnoise2(q + vec2(0.0, e0));
    g += vec2(nx - n0, nz - n0) / e0 * amp * 3.5;
    q = mat2(1.7, 1.1, -1.1, 1.7) * q + 3.1;
  }
  if (uRain > 0.0) {
    for (int l = 0; l < 2; l++) {
      float sc = l == 0 ? 2.2 : 3.7;
      vec2 q2 = p * sc + float(l) * 7.3;
      vec2 id = floor(q2), f = fract(q2);
      float hs = hash12(id + float(l) * 13.1);
      float per = 0.55 + 0.4 * hs;
      float ph = fract(t / per + hs * 7.0);
      vec2 c = hash22(id + 3.7) * 0.5 + 0.25;
      vec2 d = f - c;
      float r = length(d) + 1e-4;
      float rr = ph * 0.42;
      float k = 60.0;
      float w = exp(-pow((r - rr) / 0.045, 2.0)) * (1.0 - ph) * (1.0 - ph);
      g += d / r * cos((r - rr) * k) * w * 0.55 * uRain * gAmp(k * sc, footprint) / sc * 3.0;
    }
  }
  ringGlow = 0.0;
  float age = t - uDrop.z;
  if (uDrop.w > 0.0 && age > 0.0) {
    vec2 dp = p - uDrop.xy;
    float r = length(dp) + 1e-4;
    float decay = exp(-age * 0.9) * uDrop.w;
    float dh = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float c = 0.62 - fi * 0.15;
      float k = 38.0 + fi * 16.0;
      float front = r - c * age;
      float envl = exp(-pow(front / (0.07 + 0.05 * age), 2.0));
      dh += 0.0055 * k * cos(k * front) * envl * decay / (1.0 + fi * 0.6) * gAmp(k, footprint);
    }
    g += dp / r * dh;
    float f0 = r - 0.62 * age;
    ringGlow = exp(-pow(f0 / (0.010 + 0.018 * age), 2.0)) * exp(-age * 1.6) * uDrop.w;
    ringGlow += exp(-pow((r - 0.47 * age) / (0.012 + 0.018 * age), 2.0)) * exp(-age * 2.0) * 0.45 * uDrop.w;
    ringGlow += exp(-r * r / 0.0012) * exp(-age * 9.0) * 4.0 * uDrop.w;
  }
  return normalize(vec3(-g.x, 1.0, -g.y));
}

void main() {
  C_HOR = lin(mix(vec3(1.00, 0.76, 0.48), vec3(1.00, 0.80, 0.64), uDawn));
  C_LOW = lin(mix(vec3(0.96, 0.56, 0.40), vec3(0.96, 0.64, 0.60), uDawn));
  C_MID = lin(mix(vec3(0.55, 0.36, 0.50), vec3(0.62, 0.52, 0.68), uDawn));
  C_HIGH = lin(mix(vec3(0.20, 0.21, 0.40), vec3(0.30, 0.37, 0.58), uDawn));
  C_ZEN = lin(mix(vec3(0.05, 0.08, 0.19), vec3(0.11, 0.18, 0.36), uDawn));
  vec2 frag = gl_FragCoord.xy + uJitter;
  vec2 uv = (frag - 0.5 * uRes) / uRes.y;
  PX = 2.0 * uTanHalf / uRes.y;
  vec3 rd = normalize(uCamF + (uv.x * uCamR + uv.y * uCamU) * 2.0 * uTanHalf);
  vec3 ro = uCamPos;
  vec3 col;
  if (rd.y < -0.0005) {
    float tHit = ro.y / -rd.y;
    vec3 P = ro + rd * tHit;
    float footprint = tHit * PX / max(-rd.y, 0.02) * 0.5 + tHit * PX;
    float ringGlow;
    vec3 n = waterNormal(P.xz, footprint, ringGlow);
    vec3 rr = reflect(rd, n);
    rr.y = abs(rr.y) + 0.0005;
    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    vec3 refl = env(rr, true);
    float sd = max(dot(rr, uSunDir), 0.0);
    vec3 sunCol = mix(lin(vec3(1.0, 0.66, 0.40)), lin(vec3(1.0, 0.16, 0.06)), max(uBrand, uNight));
    float glint = (pow(sd, 900.0) * 14.0 + pow(sd, 160.0) * 0.8) * exp(-footprint * 1.5) * uSunVis * (1.0 - uStorm) * step(0.0, uSunDir.y);
    vec3 body = mix(lin(vec3(0.030, 0.034, 0.068)), lin(vec3(0.005, 0.005, 0.011)), uNight);
    body = mix(body, lin(vec3(0.05, 0.06, 0.07)), uStorm);
    col = mix(body, refl, fres) + sunCol * glint * fres;
    col += lin(vec3(1.0, 0.82, 0.55)) * ringGlow * 3.0;
    float haze = 1.0 - exp(-tHit * 0.004);
    vec2 hz = rd.xz / max(length(rd.xz), 1e-4);
    vec3 hc = skyGradient(0.0, max(dot(hz, normalize(uSunDir.xz)), 0.0), max(dot(normalize(vec3(rd.x, 0.0, rd.z)), uSunDir), 0.0));
    col = mix(col, hc, haze * 0.3);
  } else {
    col = env(rd, false);
  }
  if (uFocus > 0.0) {
    vec2 lp = sunLocal(rd);
    float d = length(lp);
    float edge = 2.0 * PX / uSunRad;
    float keep = smoothstep(1.0 + edge, 1.0 - edge, d) * step(0.0, dot(rd, uSunDir));
    float glow = exp(-max(d - 1.0, 0.0) * 2.4) * 0.3;
    float dim = pow(1.0 - uFocus, 2.6);
    col = mix(col, col * dim + lin(vec3(0.5, 0.06, 0.02)) * glow * uFocus * 0.6, 1.0 - keep);
  }
  fragColor = vec4(col * uExposure, 1.0);
}
`;

export const COMPOSITE = COMMON + `
uniform sampler2D uScene;
uniform sampler2D uLayer;
uniform sampler2D uGlow;
uniform sampler2D uSoft;
uniform vec2 uRes;
uniform float uGlowGain;
uniform float uLayerGain;
uniform vec2 uShake;        // pixels
uniform float uShakeRot;    // radians
uniform float uZoom;        // >1 zooms in
uniform vec2 uDirBlur;      // pixels, directional blur vector
uniform float uFlash;
uniform vec3 uFlashColor;
uniform float uSceneGain;

vec3 s2l(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }

vec3 fetch(vec2 uv) {
  vec3 s = texture(uScene, uv).rgb * uSceneGain;
  vec4 so = texture(uSoft, uv);
  s = s * (1.0 - so.a) + s2l(so.rgb / max(so.a, 1e-4)) * so.a;
  vec4 l = texture(uLayer, uv);
  vec3 lc = s2l(l.rgb / max(l.a, 1e-4)) * l.a;
  vec3 g = s2l(texture(uGlow, uv).rgb) * uGlowGain;
  return s * (1.0 - l.a) + lc * uLayerGain + g;
}

void main() {
  vec2 p = gl_FragCoord.xy - 0.5 * uRes;
  float cr = cos(uShakeRot), sr = sin(uShakeRot);
  p = mat2(cr, -sr, sr, cr) * p / uZoom - uShake;
  vec2 uv = (p + 0.5 * uRes) / uRes;
  vec3 col;
  float bl = length(uDirBlur);
  if (bl > 0.5) {
    col = vec3(0.0);
    const int N = 14;
    for (int i = 0; i < N; i++) {
      float o = (float(i) / float(N - 1) - 0.5);
      col += fetch(uv + uDirBlur * o / uRes);
    }
    col /= float(N);
  } else {
    col = fetch(uv);
  }
  col += uFlashColor * uFlash;
  fragColor = vec4(col, 1.0);
}
`;

export const BLOOM_PREFILTER = COMMON + `
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
vec3 karis(vec3 c) { return c / (1.0 + max(c.r, max(c.g, c.b))); }
void main() {
  vec3 a = texture(uSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  vec3 b = texture(uSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  vec3 c = texture(uSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  vec3 d = texture(uSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  float wa = 1.0 / (1.0 + max(a.r, max(a.g, a.b)));
  float wb = 1.0 / (1.0 + max(b.r, max(b.g, b.b)));
  float wc = 1.0 / (1.0 + max(c.r, max(c.g, c.b)));
  float wd = 1.0 / (1.0 + max(d.r, max(d.g, d.b)));
  vec3 col = (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
  float br = max(col.r, max(col.g, col.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-5);
  fragColor = vec4(col * contrib, 1.0);
}
`;

export const BLOOM_DOWN = COMMON + `
uniform sampler2D uSrc;
uniform vec2 uTexel;
void main() {
  vec2 t = uTexel;
  vec3 c = texture(uSrc, vUv).rgb * 0.125;
  c += (texture(uSrc, vUv + t * vec2(-1.0, -1.0)).rgb + texture(uSrc, vUv + t * vec2(1.0, -1.0)).rgb +
        texture(uSrc, vUv + t * vec2(-1.0, 1.0)).rgb + texture(uSrc, vUv + t * vec2(1.0, 1.0)).rgb) * 0.125;
  c += (texture(uSrc, vUv + t * vec2(-2.0, 0.0)).rgb + texture(uSrc, vUv + t * vec2(2.0, 0.0)).rgb +
        texture(uSrc, vUv + t * vec2(0.0, -2.0)).rgb + texture(uSrc, vUv + t * vec2(0.0, 2.0)).rgb) * 0.0625;
  c += (texture(uSrc, vUv + t * vec2(-2.0, -2.0)).rgb + texture(uSrc, vUv + t * vec2(2.0, -2.0)).rgb +
        texture(uSrc, vUv + t * vec2(-2.0, 2.0)).rgb + texture(uSrc, vUv + t * vec2(2.0, 2.0)).rgb) * 0.03125;
  fragColor = vec4(c, 1.0);
}
`;

export const BLOOM_UP = COMMON + `
uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform float uWeight;
void main() {
  vec2 t = uTexel;
  vec3 c = texture(uSrc, vUv).rgb * 4.0;
  c += (texture(uSrc, vUv + vec2(t.x, 0.0)).rgb + texture(uSrc, vUv - vec2(t.x, 0.0)).rgb +
        texture(uSrc, vUv + vec2(0.0, t.y)).rgb + texture(uSrc, vUv - vec2(0.0, t.y)).rgb) * 2.0;
  c += texture(uSrc, vUv + t).rgb + texture(uSrc, vUv - t).rgb + texture(uSrc, vUv + vec2(t.x, -t.y)).rgb + texture(uSrc, vUv + vec2(-t.x, t.y)).rgb;
  fragColor = vec4(c / 16.0 * uWeight, 1.0);
}
`;

export const GRADE = COMMON + `
uniform sampler2D uComp;
uniform sampler2D uBloom;
uniform vec2 uRes;
uniform float uBloomAmt;
uniform float uCA;
uniform float uVignette;
uniform float uExposure;
uniform float uWarm;       // warm filmic grade amount
uniform float uSat;
uniform float uContrast;
uniform float uHalation;
uniform float uFade;       // 1 = fully black
uniform float uAccumWeight;

vec3 shoulder(vec3 x) {
  // identity below the knee so flat brand colours survive, soft roll-off above
  float k = 0.78;
  vec3 over = max(x - k, 0.0);
  return min(x, vec3(k)) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}
vec3 l2s(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 uv = vUv;
  vec2 d = uv - 0.5;
  float r2 = dot(d, d);
  vec3 col;
  if (uCA > 0.0) {
    vec2 off = d * uCA * (0.4 + r2 * 2.0);
    col.r = texture(uComp, uv - off).r;
    col.g = texture(uComp, uv).g;
    col.b = texture(uComp, uv + off).b;
  } else col = texture(uComp, uv).rgb;
  vec3 bloom = texture(uBloom, uv).rgb;
  col += bloom * uBloomAmt;
  // halation: warm-red fringe around highlights (film look)
  col += bloom * vec3(1.0, 0.25, 0.08) * uHalation;
  col *= uExposure;
  // warm filmic split-tone: cool shadows, warm highlights
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 warm = col * vec3(1.06, 1.0, 0.9);
  warm = mix(warm + vec3(-0.004, 0.0, 0.012) * (1.0 - smoothstep(0.0, 0.2, l)), warm, 0.5);
  col = mix(col, warm, uWarm);
  col = shoulder(col);
  // contrast around mid grey (in a perceptual-ish space)
  vec3 s = l2s(col);
  s = mix(vec3(0.5), s, uContrast);
  float sl = dot(s, vec3(0.2126, 0.7152, 0.0722));
  s = mix(vec3(sl), s, uSat);
  // vignette
  float aspect = uRes.x / uRes.y;
  float vig = smoothstep(1.25, 0.35, length(d * vec2(aspect, 1.0) * 1.05));
  s *= mix(1.0, vig, uVignette);
  s *= 1.0 - uFade;
  fragColor = vec4(clamp(s, 0.0, 1.0) * uAccumWeight, uAccumWeight);
}
`;

export const PRESENT = COMMON + `
uniform sampler2D uAccum;
uniform vec2 uRes;
uniform float uTime;
uniform float uGrain;
uniform float uLetterbox;   // bar height as fraction of frame height
uniform float uSeed;
void main() {
  vec3 c = texture(uAccum, vUv).rgb;
  // film grain: luminance-weighted, strongest in mid-tones
  vec2 gp = gl_FragCoord.xy + vec2(uSeed * 131.7, uSeed * 71.3);
  float n1 = hash12(gp) + hash12(gp + 17.31) - 1.0;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float amt = uGrain * (0.35 + 0.65 * (1.0 - abs(l - 0.45) * 1.6));
  c += n1 * amt;
  float y = gl_FragCoord.y / uRes.y;
  float bar = step(y, uLetterbox) + step(1.0 - uLetterbox, y);
  c = mix(c, vec3(0.0), clamp(bar, 0.0, 1.0));
  // triangular dither to kill banding in 8-bit output
  float dth = (hash12(gl_FragCoord.xy * 1.37 + uSeed) + hash12(gl_FragCoord.xy * 0.73 + 9.1 + uSeed) - 1.0) / 255.0;
  fragColor = vec4(c + dth, 1.0);
}
`;

export const BLUR = COMMON + `
uniform sampler2D uSrc;
uniform vec2 uDir;
void main() {
  vec4 c = texture(uSrc, vUv) * 0.19648255;
  c += (texture(uSrc, vUv + uDir * 1.41176471) + texture(uSrc, vUv - uDir * 1.41176471)) * 0.29690696;
  c += (texture(uSrc, vUv + uDir * 3.29411765) + texture(uSrc, vUv - uDir * 3.29411765)) * 0.09447040;
  c += (texture(uSrc, vUv + uDir * 5.17647059) + texture(uSrc, vUv - uDir * 5.17647059)) * 0.01038136;
  fragColor = c;
}
`;
