// Post-processing pipeline (self-contained): MSAA HDR scene -> tinted ambient occlusion -> bloom -> tone map + grade.
// Quality levels: 3 = full, 2 = lower resolution, 1 = no AO, 0 = plain render. Steps down on its own when frames are slow.
import * as THREE from 'three';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

const AO_FRAG = `
uniform sampler2D tDepth; uniform vec2 uRes; uniform mat4 uProj, uInvProj; uniform float uRadius, uFar; varying vec2 vUv;
vec3 viewPos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 p = uInvProj * vec4(vec3(uv, d) * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main(){
  float d0 = texture2D(tDepth, vUv).x;
  if (d0 >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv);
  vec2 px = 1.0 / uRes;
  vec3 r = viewPos(vUv + vec2(px.x, 0.0)) - P, l = P - viewPos(vUv - vec2(px.x, 0.0));
  vec3 u = viewPos(vUv + vec2(0.0, px.y)) - P, b = P - viewPos(vUv - vec2(0.0, px.y));
  vec3 dx = abs(r.z) < abs(l.z) ? r : l, dy = abs(u.z) < abs(b.z) ? u : b;
  vec3 N = normalize(cross(dx, dy));
  float occ = 0.0, ang0 = ign(gl_FragCoord.xy) * 6.2831853;
  float rr = uRadius * uProj[1][1] * 0.5 / -P.z;
  vec2 asp = vec2(uRes.y / uRes.x, 1.0);
  for (int i = 0; i < AO_N; i++) {
    float f = (float(i) + 0.5) / float(AO_N);
    float a = ang0 + f * 6.2831853 * 4.0;
    vec2 q = vUv + vec2(cos(a), sin(a)) * asp * rr * (0.08 + 0.92 * f);
    vec3 v = viewPos(q) - P;
    float vv = dot(v, v), vn = dot(v, N) - 0.012;
    float k = max(0.0, 1.0 - vv / (uRadius * uRadius));
    occ += max(0.0, vn) / sqrt(vv + 1e-4) * k * k;
  }
  float ao = clamp(1.0 - occ / float(AO_N) * 2.9, 0.0, 1.0);
  gl_FragColor = vec4(ao, -P.z / uFar, 0.0, 1.0);
}`;

const BLUR_FRAG = `
uniform sampler2D tAO; uniform vec2 uDir; uniform float uFar; varying vec2 vUv;
void main(){
  vec4 c = texture2D(tAO, vUv); float s = c.r, w = 1.0;
  for (int i = -3; i <= 3; i++) { if (i == 0) continue;
    vec4 q = texture2D(tAO, vUv + uDir * float(i));
    float k = exp(-float(i * i) * 0.16) * max(0.0, 1.0 - abs(q.g - c.g) * uFar * 4.0);
    s += q.r * k; w += k; }
  gl_FragColor = vec4(s / w, c.g, 0.0, 1.0);
}`;

const PREF_FRAG = `
uniform sampler2D tColor; uniform vec2 uPx; uniform float uThresh; varying vec2 vUv;
vec3 pre(vec3 c){ c = min(c, vec3(8.0)); float m = max(c.r, max(c.g, c.b)); float k = max(0.0, m - uThresh); return c * k / max(m, 1e-4); }
void main(){
  vec3 s = pre(texture2D(tColor, vUv + uPx * vec2(-1.0, -1.0)).rgb) + pre(texture2D(tColor, vUv + uPx * vec2(1.0, -1.0)).rgb)
         + pre(texture2D(tColor, vUv + uPx * vec2(-1.0, 1.0)).rgb) + pre(texture2D(tColor, vUv + uPx * vec2(1.0, 1.0)).rgb);
  gl_FragColor = vec4(s * 0.25, 1.0);
}`;
const DOWN_FRAG = `
uniform sampler2D tColor; uniform vec2 uPx; varying vec2 vUv;
void main(){
  vec3 s = texture2D(tColor, vUv).rgb * 4.0;
  s += texture2D(tColor, vUv + uPx * vec2(-1.0, -1.0)).rgb + texture2D(tColor, vUv + uPx * vec2(1.0, -1.0)).rgb
     + texture2D(tColor, vUv + uPx * vec2(-1.0, 1.0)).rgb + texture2D(tColor, vUv + uPx * vec2(1.0, 1.0)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;
const UP_FRAG = `
uniform sampler2D tColor, tAdd; uniform vec2 uPx; varying vec2 vUv;
void main(){
  vec3 s = vec3(0.0);
  s += texture2D(tColor, vUv + uPx * vec2(-2.0, 0.0)).rgb + texture2D(tColor, vUv + uPx * vec2(2.0, 0.0)).rgb
     + texture2D(tColor, vUv + uPx * vec2(0.0, -2.0)).rgb + texture2D(tColor, vUv + uPx * vec2(0.0, 2.0)).rgb;
  s += 2.0 * (texture2D(tColor, vUv + uPx * vec2(-1.0, 1.0)).rgb + texture2D(tColor, vUv + uPx * vec2(1.0, 1.0)).rgb
     + texture2D(tColor, vUv + uPx * vec2(-1.0, -1.0)).rgb + texture2D(tColor, vUv + uPx * vec2(1.0, -1.0)).rgb);
  gl_FragColor = vec4(s / 12.0 + texture2D(tAdd, vUv).rgb, 1.0);
}`;

const FINAL_FRAG = `
uniform sampler2D tColor, tAO, tBloom; uniform float uAO, uBloom, uExposure, uSat, uContrast, uTintAmt, uVig; uniform vec3 uShadowTint, uAoTint; varying vec2 vUv;
vec3 neutral(vec3 color){
  const float S = 0.8 - 0.04; const float D = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float off = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= off;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < S) return color;
  float d = 1.0 - S; float np = 1.0 - d * d / (peak + d - S);
  color *= np / peak;
  float g = 1.0 - 1.0 / (D * (peak - np) + 1.0);
  return mix(color, vec3(np), g);
}
void main(){
  vec3 c = texture2D(tColor, vUv).rgb;
  float ao = mix(1.0, texture2D(tAO, vUv).r, uAO);
  c *= mix(uAoTint, vec3(1.0), ao);
  c += texture2D(tBloom, vUv).rgb * uBloom;
  c = neutral(max(c, 0.0) * uExposure);
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += uShadowTint * uTintAmt * (1.0 - smoothstep(0.0, 0.45, L)) * (0.25 + L);
  c = max(vec3(0.0), mix(vec3(L), c, uSat));
  c = sRGBTransferOETF(vec4(clamp(c, 0.0, 1.0), 1.0)).rgb;
  c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
  vec2 v = vUv - 0.5; c *= 1.0 - uVig * smoothstep(0.25, 0.85, length(v * vec2(1.1, 1.0)));
  float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  gl_FragColor = vec4(c + (n - 0.5) / 255.0, 1.0);
}`;

const LEVELS = 5;

export class Post {
  constructor(renderer) {
    this.r = renderer;
    this.level = 3; this.maxLevel = 3; this._locked = false;
    this._w = 0; this._h = 0; this._times = []; this._last = 0; this._slow = 0;
    if (!renderer.extensions.has('EXT_color_buffer_half_float') && !renderer.extensions.has('EXT_color_buffer_float')) this.level = this.maxLevel = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this._quad = new THREE.Mesh(g, null); this._quad.frustumCulled = false;
    this._scene = new THREE.Scene(); this._scene.add(this._quad);
    this._cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._size = new THREE.Vector2();
    const mk = (frag, uniforms, defines = {}) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, defines, depthTest: false, depthWrite: false, toneMapped: false });
    const T = () => ({ value: null }), V2 = () => ({ value: new THREE.Vector2() });
    this.mAO = mk(AO_FRAG, { tDepth: T(), uRes: V2(), uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() }, uRadius: { value: 0.42 }, uFar: { value: 100 } }, { AO_N: 12 });
    this.mBlur = mk(BLUR_FRAG, { tAO: T(), uDir: V2(), uFar: { value: 100 } });
    this.mPref = mk(PREF_FRAG, { tColor: T(), uPx: V2(), uThresh: { value: 1.05 } });
    this.mDown = mk(DOWN_FRAG, { tColor: T(), uPx: V2() });
    this.mUp = mk(UP_FRAG, { tColor: T(), tAdd: T(), uPx: V2() });
    this.mFinal = mk(FINAL_FRAG, {
      tColor: T(), tAO: T(), tBloom: T(), uAO: { value: 1 }, uBloom: { value: 0.12 }, uExposure: { value: 1 }, uSat: { value: 1 }, uContrast: { value: 1 },
      uTintAmt: { value: 0 }, uVig: { value: 0 }, uShadowTint: { value: new THREE.Color() }, uAoTint: { value: new THREE.Color() },
    });
    this._white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); this._white.needsUpdate = true;
  }

  setGrade(g) {
    const u = this.mFinal.uniforms;
    u.uExposure.value = g.exposure; u.uSat.value = g.saturation; u.uContrast.value = g.contrast; u.uTintAmt.value = g.tintAmt; u.uVig.value = g.vignette;
    u.uShadowTint.value.set(g.shadowTint); u.uAoTint.value.set(g.aoTint); u.uBloom.value = g.bloom ?? 0.12;
  }

  /** Fix the quality level (0-3); null = adaptive. */
  lock(level) {
    this._locked = level != null;
    if (this._locked) { this.level = Math.max(0, Math.min(level, this.maxLevel)); this._dirty = true; }
  }

  _free() {
    for (const t of [this.rt, this.ao1, this.ao2, ...(this.down || []), ...(this.up || [])]) { t?.depthTexture?.dispose(); t?.dispose(); }
    this.rt = this.ao1 = this.ao2 = null; this.down = this.up = null;
  }

  _alloc(w, h) {
    this._free();
    const o = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
    const k = this.level >= 3 ? 1 : Math.min(1, (this.level === 2 ? 1.25 : 1) / this.r.getPixelRatio());
    const W = Math.max(2, Math.round(w * k)), H = Math.max(2, Math.round(h * k));
    this.rt = new THREE.WebGLRenderTarget(W, H, { ...o, depthBuffer: true, samples: 4 });
    if (this.level >= 2) {
      this.rt.depthTexture = new THREE.DepthTexture(W, H, THREE.UnsignedIntType);
      const aw = Math.max(2, W >> 1), ah = Math.max(2, H >> 1);
      this.ao1 = new THREE.WebGLRenderTarget(aw, ah, o); this.ao2 = new THREE.WebGLRenderTarget(aw, ah, o);
    }
    this.down = []; this.up = [];
    let x = W, y = H;
    for (let i = 0; i < LEVELS; i++) {
      x = Math.max(2, x >> 1); y = Math.max(2, y >> 1);
      this.down.push(new THREE.WebGLRenderTarget(x, y, o));
      if (i < LEVELS - 1) this.up.push(new THREE.WebGLRenderTarget(x, y, o));
    }
    this._w = w; this._h = h; this._dirty = false;
  }

  _pass(mat, target) { this._quad.material = mat; this.r.setRenderTarget(target); this.r.render(this._scene, this._cam); }

  render(scene, camera) {
    const r = this.r;
    if (!this._locked) this._adapt();
    if (this.level === 0) { r.setRenderTarget(null); r.render(scene, camera); return; }
    r.getDrawingBufferSize(this._size);
    if (this._dirty || this._size.x !== this._w || this._size.y !== this._h) this._alloc(this._size.x, this._size.y);
    r.setRenderTarget(this.rt); r.render(scene, camera);
    const auto = r.shadowMap.autoUpdate;
    r.shadowMap.autoUpdate = false;
    if (this.ao1) {
      const u = this.mAO.uniforms;
      u.tDepth.value = this.rt.depthTexture; u.uRes.value.set(this.ao1.width, this.ao1.height);
      u.uProj.value.copy(camera.projectionMatrix); u.uInvProj.value.copy(camera.projectionMatrixInverse); u.uFar.value = camera.far;
      this._pass(this.mAO, this.ao1);
      const b = this.mBlur.uniforms; b.uFar.value = camera.far;
      b.tAO.value = this.ao1.texture; b.uDir.value.set(1 / this.ao1.width, 0); this._pass(this.mBlur, this.ao2);
      b.tAO.value = this.ao2.texture; b.uDir.value.set(0, 1 / this.ao1.height); this._pass(this.mBlur, this.ao1);
    }
    let src = this.rt;
    this.down.forEach((t, i) => {
      const m = i ? this.mDown : this.mPref;
      m.uniforms.tColor.value = src.texture; m.uniforms.uPx.value.set(1 / src.width, 1 / src.height);
      this._pass(m, t); src = t;
    });
    for (let i = LEVELS - 2; i >= 0; i--) {
      const u = this.mUp.uniforms; u.tColor.value = src.texture; u.tAdd.value = this.down[i].texture; u.uPx.value.set(0.5 / src.width, 0.5 / src.height);
      this._pass(this.mUp, this.up[i]); src = this.up[i];
    }
    const f = this.mFinal.uniforms;
    f.tColor.value = this.rt.texture; f.tAO.value = this.ao1 ? this.ao1.texture : this._white; f.tBloom.value = src.texture;
    this._pass(this.mFinal, null);
    r.shadowMap.autoUpdate = auto;
  }

  _adapt() {
    const now = performance.now(), dt = now - this._last; this._last = now;
    if (dt <= 0 || dt > 250) { this._times.length = 0; return; } // tab was hidden / first frame
    this._times.push(dt);
    if (this._times.length < 90) return;
    const t = this._times.sort((a, b) => a - b)[60]; this._times.length = 0;
    this._slow = t > 30 ? this._slow + 1 : 0;
    if (this._slow >= 2 && this.level > 0) { this.level--; this._slow = 0; this._dirty = true; if (this.level === 0) this._free(); }
  }

  dispose() {
    this._free();
    for (const m of [this.mAO, this.mBlur, this.mPref, this.mDown, this.mUp, this.mFinal]) m.dispose();
    this._quad.geometry.dispose(); this._white.dispose();
  }
}
