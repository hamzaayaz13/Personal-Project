/* Distortion wave (center type) for the web: a WebGL port of Libraries.dev's
 * DistortionWavesKit (MIT, © Jakub Antalik). A ring of colour opens from a source
 * (the orb), and carries the screen under it into a video: a swell with chromatic
 * aberration and progressive blur on the incoming side, a colour band riding the
 * front, colour clinging to the window's edges, and a hairline on the glass.
 *
 * DistortionWave.run(canvas, video, { cx, cy, r, bg, onDone }) */
(function () {
  const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  const FS = `
precision highp float;
uniform vec2 uSize; uniform float uDpr;
uniform vec2 uOrigin; uniform float uRadius, uTime, uEnergy, uSwell, uGlow, uClear, uRim, uHold, uLaunched, uHairClear;
uniform float uAmp, uLens, uAberr, uBlur, uBlurA, uBlurB, uLead, uTail, uStrength, uRimW, uRimSoft, uPulse, uHairW, uHairO, uHairWhite;
uniform sampler2D uVid; uniform vec2 uVidSize; uniform vec3 uBg;
uniform vec3 uPal[9];
const float coverZone = 60.0;
float sq(float x){return x*x;}
float heldAt(vec2 p){ if(uHold<=0.0) return 1.0; return smoothstep(uHold*0.9,uHold*1.8,length(p-uOrigin)); }
float fieldD(vec2 p, out vec2 n, out vec2 raw){
  raw = p-uOrigin; float l=max(length(raw),1e-3); n = raw/l;
  float a = atan(raw.y, raw.x);
  float bend = 0.62*sin(2.0*a+uTime*1.1)+0.38*sin(3.0*a-uTime*1.5+1.7);
  return (l-uRadius) + uSwell*bend;
}
/* the video, contained in the window like the <video> that takes over after */
vec4 vid(vec2 p){
  float s = min(uSize.x/uVidSize.x, uSize.y/uVidSize.y);
  vec2 sz = uVidSize*s, off=(uSize-sz)*0.5;
  vec2 uv = (p-off)/sz;
  if(uv.x<0.0||uv.y<0.0||uv.x>1.0||uv.y>1.0) return vec4(uBg,1.0);
  return texture2D(uVid, vec2(uv.x, uv.y));
}
vec4 blurVid(vec2 p, float r){
  if(r<0.6) return vid(p);
  vec4 c = vid(p)*0.2;
  for(int i=0;i<8;i++){ float a=float(i)*0.785398; c += vid(p+vec2(cos(a),sin(a))*r)*0.1; }
  return c;
}
vec3 oklabToSRGB(vec3 c){
  float l=c.x+0.3963377774*c.y+0.2158037573*c.z, m=c.x-0.1055613458*c.y-0.0638541728*c.z, s=c.x-0.0894841775*c.y-1.2914855480*c.z;
  l=l*l*l; m=m*m*m; s=s*s*s;
  vec3 lin=clamp(vec3(4.0767416621*l-3.3077115913*m+0.2309699292*s,-1.2684380046*l+2.6097574011*m-0.3413193965*s,-0.0041960863*l-0.7034186147*m+1.7076147010*s),0.0,1.0);
  return mix(12.92*lin, 1.055*pow(lin,vec3(1.0/2.4))-0.055, step(vec3(0.0031308),lin));
}
vec3 pal(float u){
  float x=fract(u)*7.0; float fi=floor(x); float m=fract(x); m=m*m*(3.0-2.0*m);
  vec3 a=uPal[0], b=uPal[1];
  for(int i=0;i<7;i++){ if(float(i)==fi){ a=uPal[i]; b=uPal[i==6?0:i+1]; } }
  return mix(a,b,m);
}
float dither(vec2 p){return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715))))-0.5;}
void main(){
  vec2 p = vec2(gl_FragCoord.x, uSize.y*uDpr-gl_FragCoord.y)/uDpr;
  vec2 n, raw; float d = fieldD(p, n, raw);
  float held = heldAt(p);
  /* incoming side: behind the front (d<0) */
  vec4 inc = vec4(0.0);
  if(uLaunched>0.5 && d < coverZone+6.0){
    float u = d/(uLens*(d>0.0?0.85:1.5)); float lift=exp(-u*u);
    vec2 sw = n*uEnergy*uAmp*lift*held; vec2 s = p-sw;
    float ub = d/(d>0.0?uBlurA:uBlurB); float br = uEnergy*uBlur*exp(-ub*ub)*held;
    vec2 split = sw*uAberr;
    if(dot(split,split)<0.0625){ inc = blurVid(s, br); }
    else {
      vec3 c = vec3(0.0);
      c += blurVid(s-split,br).rgb*vec3(0.571,0.0,0.0);
      c += blurVid(s-split*0.5,br).rgb*vec3(0.343,0.206,0.0);
      c += blurVid(s,br).rgb*vec3(0.086,0.588,0.086);
      c += blurVid(s+split*0.5,br).rgb*vec3(0.0,0.206,0.343);
      c += blurVid(s+split,br).rgb*vec3(0.0,0.0,0.571);
      inc = vec4(c,1.0);
    }
    float cover = smoothstep(-coverZone, coverZone, d);
    inc.a = 1.0-cover; inc.rgb *= inc.a;
  }
  /* colour: the band on the front, the rim on the edges, the hairline */
  vec2 c = p-uSize*0.5;
  float inset = max(min(min(p.x, uSize.x-p.x), min(p.y, uSize.y-p.y)), 0.0);
  float turn = atan(raw.y, raw.x);
  float lobes = 0.5+0.5*sin(2.0*turn+uTime*1.4)*cos(turn-uTime*0.7+1.2);
  float bandA = 0.0;
  if(uGlow>0.0 && d<uLead){
    if(d>=0.0){ float k=1.0-d/uLead; bandA=k*k*k*(k*(k*6.0-15.0)+10.0); }
    else bandA = pow(1.0-clamp(-d/(uTail*mix(0.6,1.3,lobes)),0.0,1.0),2.3);
    bandA *= uGlow*uStrength*mix(0.6,1.0,exp(-inset/140.0))*held;
  }
  float around = atan(c.y/uSize.y, c.x/uSize.x);
  float rimA=0.0, hairA=0.0, shimmer=0.5;
  if(uRim>0.0 && inset < uRimW*6.0){
    float edgeS = around/6.2831853;
    float thick = max(1.0 + 0.9*sin(edgeS*18.85+uTime*0.6)*cos(edgeS*12.57-uTime*0.4+1.3), 0.08);
    float hug = exp(-sq(inset/(uRimW*thick)));
    float reached = 1.0-smoothstep(-uLead*0.7, uLead*0.5, d);
    float kept = smoothstep(-uRimSoft, uRimSoft, d+(uRadius-uClear));
    shimmer = 0.5+0.5*sin(uTime*3.4-edgeS*4.0*3.14159);
    rimA = hug*reached*kept*uRim*mix(1.0,0.7+0.3*shimmer,uPulse);
    float line = 1.0-smoothstep(uHairW*0.5, uHairW*0.5+0.75, inset);
    float hairKept = smoothstep(-uRimSoft, uRimSoft, d+(uRadius-uHairClear));
    hairA = line*reached*hairKept*uRim*uHairO*mix(1.0,0.55+0.45*shimmer,uPulse);
  }
  float a = 1.0-(1.0-bandA)*(1.0-rimA);
  float total = 1.0-(1.0-a)*(1.0-hairA);
  vec4 col = vec4(0.0);
  if(total>0.0005){
    float flow = 0.62 + turn/6.2831853 + uTime*0.13 + d*0.0015;
    vec3 lab = pal(flow);
    lab = mix(lab, uPal[7], 0.5*exp(-sq((d-30.0)/50.0)));
    lab = mix(lab, uPal[8], 0.5*exp(-sq((d+84.0)/72.0)));
    lab.yz *= 1.22;
    lab = mix(lab, vec3(0.99,0.0,0.0), 0.7*exp(-sq((d+8.0)/26.0)));
    vec3 rimLab = pal(around/6.2831853 + uTime*(0.12+0.25*uPulse) + inset*0.0012); rimLab.yz *= 1.1;
    lab = mix(lab, rimLab, rimA/(rimA+bandA+1e-4));
    vec3 rgb = oklabToSRGB(lab);
    if(hairA>0.0){ vec3 hair = mix(oklabToSRGB(rimLab), vec3(1.0), uHairWhite*(0.5+0.5*shimmer)); rgb=(rgb*a*(1.0-hairA)+hair*hairA)/total; }
    float nz = dither(p)*2.0/255.0;
    col = vec4(clamp(rgb*total+nz,0.0,1.0), clamp(total+nz,0.0,1.0));
  }
  /* colour over the incoming side (premultiplied) */
  gl_FragColor = col + inc*(1.0-col.a);
}`;

  function bez(x1, y1, x2, y2) { // cubic-bezier easing, solved for x
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const cx = 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t - x;
        const dx = 3 * x1 * (1 - t) * (1 - t) + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
        if (Math.abs(dx) < 1e-6) break; t -= cx / dx; t = Math.min(1, Math.max(0, t));
      }
      return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
    };
  }
  const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  function oklab(r, g, b) {
    const lin = (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const lr = lin(r), lg = lin(g), lb = lin(b);
    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  // the colourful palette (VoiceGlow's), then the pink fringe ahead and the blue one behind
  const PAL = [[255, 201, 21], [126, 196, 255], [180, 40, 230], [235, 100, 160], [255, 176, 122], [154, 160, 255], [127, 217, 238], [255, 122, 182], [90, 190, 255]].map((c) => oklab(c[0], c[1], c[2]));

  // full-screen tuning (the kit's base lengths; the center type's timing)
  const S = { anticipation: 0.25, travel: 3.43, linger: -0.35, rimFade: 2.51, hairlineLinger: 0.96, hairlineFade: 3.0,
    inhale: 56, swell: 22, amplitude: 34, lensWidth: 150, aberration: 0.55, blur: 18, blurAhead: 90, blurBehind: 240,
    lead: 130, tail: 300, strength: 0.75, rimWidth: 14, rimStrength: 0.75, rimSoftness: 343, rimPulse: 0.6,
    hairlineWidth: 1.5, hairlineOpacity: 0.9, hairlineWhite: 0.95 };
  const ease = bez(0.22, 1, 0.36, 1), rimEase = bez(0.42, 0, 0.58, 1);
  const COVER = 60, OVERSHOOT = 100;
  const DURATION = S.anticipation + Math.max(S.travel * 0.6, S.linger + S.rimFade, S.linger + S.hairlineLinger + S.hairlineFade);

  function run(canvas, video, opts) {
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) { opts.onDone && opts.onDone(); return; }
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = (n) => gl.getUniformLocation(pr, n);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([14, 11, 18, 255]));
    gl.uniform3fv(U('uPal'), new Float32Array(PAL.flat()));
    const bg = opts.bg || [14 / 255, 11 / 255, 18 / 255];
    gl.uniform3f(U('uBg'), bg[0], bg[1], bg[2]);
    const set = { uAmp: S.amplitude, uLens: S.lensWidth, uAberr: S.aberration, uBlur: S.blur, uBlurA: S.blurAhead, uBlurB: S.blurBehind,
      uLead: S.lead, uTail: S.tail, uStrength: S.strength, uRimW: S.rimWidth, uRimSoft: S.rimSoftness, uPulse: S.rimPulse,
      uHairW: S.hairlineWidth, uHairO: S.hairlineOpacity, uHairWhite: S.hairlineWhite };
    for (const k in set) gl.uniform1f(U(k), set[k]);
    let started = false, t0 = 0, raf = 0, done = false;
    function frame(now) {
      if (!t0) t0 = now;
      const t = opts.clock ? opts.clock() : (now - t0) / 1000;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      gl.viewport(0, 0, canvas.width, canvas.height);
      const cx = opts.cx(), cy = opts.cy(), r0 = opts.r;
      let reach = 0; [[0, 0], [w, 0], [0, h], [w, h]].forEach((p) => { reach = Math.max(reach, Math.hypot(p[0] - cx, p[1] - cy)); });
      const crossed = reach + S.swell + COVER;
      const since = t - S.anticipation, gathered = smooth(0, S.anticipation, t);
      const x = Math.min(Math.max(since / S.travel, 0), 1), moved = ease(x);
      const settling = 1 - smooth(0.2, 0.55, x);
      const radius = since < 0 ? r0 + S.inhale * (1 - gathered) : r0 + (crossed + OVERSHOOT - r0) * moved;
      const clearStart = r0 - S.rimSoftness, clearEnd = reach + S.rimSoftness + S.swell;
      const clr = (k) => clearStart + (clearEnd - clearStart) * rimEase(Math.min(Math.max(k, 0), 1));
      if (since > 0 && !started) { started = true; opts.onLaunch && opts.onLaunch(); }
      if (video && video.readyState >= 2) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); } catch (e) {}
        gl.uniform2f(U('uVidSize'), video.videoWidth || 1920, video.videoHeight || 1080);
      } else gl.uniform2f(U('uVidSize'), 1920, 1080);
      gl.uniform2f(U('uSize'), w, h); gl.uniform1f(U('uDpr'), dpr);
      gl.uniform2f(U('uOrigin'), cx, cy); gl.uniform1f(U('uRadius'), radius); gl.uniform1f(U('uTime'), t);
      gl.uniform1f(U('uEnergy'), smooth(0, 0.05, x) * settling); gl.uniform1f(U('uSwell'), S.swell * smooth(0, 0.3, moved));
      gl.uniform1f(U('uGlow'), since < 0 ? 0 : smooth(0, 0.07, x) * settling);
      gl.uniform1f(U('uClear'), clr((since - S.linger) / S.rimFade));
      gl.uniform1f(U('uHairClear'), clr((since - S.linger - S.hairlineLinger) / S.hairlineFade));
      gl.uniform1f(U('uRim'), S.rimStrength * smooth(0, 0.1, x) * (1 - smooth(0.9, 1, t / DURATION)));
      gl.uniform1f(U('uHold'), r0); gl.uniform1f(U('uLaunched'), since > 0 ? 1 : 0);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (radius > crossed && !opts._covered) { opts._covered = true; opts.onCovered && opts.onCovered(); }
      if (t < DURATION) raf = requestAnimationFrame(frame);
      else if (!done) { done = true; opts.onDone && opts.onDone(); }
    }
    raf = requestAnimationFrame(frame);
    return { stop() { cancelAnimationFrame(raf); } };
  }
  window.DistortionWave = { run: run, duration: DURATION };
})();
