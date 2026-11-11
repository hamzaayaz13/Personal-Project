import { AbsoluteFill, Composition, Img, registerRoot, staticFile, useCurrentFrame } from "raea";
import { Canvas3D, Entity, ImagePlane, ToneMapping, manifold, type Solid } from "raea/3d";
import { StandardMaterial } from "raea/pbr";
import { Mesh3d } from "raea/mesh";
import { AmbientLight, DirectionalLight } from "raea/light";
import { Quat, Transform } from "raea/transform";
import { Camera3d } from "raea/camera";

/* ================= tokens ================= */
const ORANGE = "#FF5A00", ACCENT = "#D64500", INK = "#1F1F1F", BG = "#FBF8F5";
const FONTS = [300, 400, 500, 700, 800, 900]
  .map((w) => `@font-face{font-family:Figtree;font-weight:${w};src:url(${staticFile(`fonts/figtree-${w}.ttf`)})}`).join("");
const FPS = 30;

/* ================= easing ================= */
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;
const backOut = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const ramp = (f: number, a: number, b: number, e = easeInOut) => e(clamp01((f - a) / (b - a)));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function track(f: number, k: [number, number][]) {
  if (f <= k[0][0]) return k[0][1];
  for (let i = 0; i < k.length - 1; i++) {
    const [f0, v0] = k[i], [f1, v1] = k[i + 1];
    if (f <= f1) return mix(v0, v1, easeInOut(clamp01((f - f0) / (f1 - f0))));
  }
  return k[k.length - 1][1];
}

/* ================= the 3D phone ================= */
const W = 0.716, H = 1.48, D = 0.041, R = 0.118;
const SCR_W = 0.666, SCR_H = SCR_W * 932 / 430;
const slab = (w: number, h: number, d: number, r: number) =>
  manifold.cylinder(r, d).move(-w / 2 + r, -h / 2 + r, -d / 2)
    .hull(manifold.cylinder(r, d).move(w / 2 - r, -h / 2 + r, -d / 2))
    .hull(manifold.cylinder(r, d).move(-w / 2 + r, h / 2 - r, -d / 2))
    .hull(manifold.cylinder(r, d).move(w / 2 - r, h / 2 - r, -d / 2));
let body: Solid, glass: Solid, btn: Solid, btn2: Solid;
const getBody = () => (body ??= slab(W, H, D, R));
const getGlass = () => (glass ??= slab(W - 0.016, H - 0.016, 0.004, R - 0.008));
const getBtn = () => (btn ??= manifold.roundedBox(0.01, 0.16, 0.018, 0.004));
const getBtn2 = () => (btn2 ??= manifold.roundedBox(0.01, 0.09, 0.018, 0.004));
const TI = { base_color: "#a7a39d", metallic: 0.9, perceptual_roughness: 0.28 } as const;

type P3 = { x: number; y: number; z: number; rx: number; ry: number; rz: number; s: number };
const HIDE: P3 = { x: 0, y: 0, z: -80, rx: 0, ry: 0, rz: 0, s: 0.001 };
function Phone3D({ id, src, p }: { id: string; src: string; p: P3 }) {
  return (
    <Entity transform={Transform.fromXyz(p.x, p.y, p.z).withRotation(Quat.fromEuler("XYZ", p.rx, p.ry, p.rz)).withScale([p.s, p.s, p.s])}>
      <Mesh3d name={id + "-body"} shape={getBody()}><StandardMaterial {...TI} /></Mesh3d>
      <Mesh3d name={id + "-glass"} transform={Transform.fromXyz(0, 0, D / 2)} shape={getGlass()}>
        <StandardMaterial base_color="#050505" perceptual_roughness={0.12} clearcoat={1} clearcoat_perceptual_roughness={0.02} />
      </Mesh3d>
      <Mesh3d name={id + "-b1"} transform={Transform.fromXyz(W / 2 + 0.001, 0.2, 0)} shape={getBtn()}><StandardMaterial {...TI} /></Mesh3d>
      <Mesh3d name={id + "-b2"} transform={Transform.fromXyz(-W / 2 - 0.001, 0.33, 0)} shape={getBtn2()}><StandardMaterial {...TI} /></Mesh3d>
      <Mesh3d name={id + "-b3"} transform={Transform.fromXyz(-W / 2 - 0.001, 0.18, 0)} shape={getBtn2()}><StandardMaterial {...TI} /></Mesh3d>
      <ImagePlane src={src} width={SCR_W} position={[0, 0, D / 2 + 0.003]} />
    </Entity>
  );
}
const CAM_Z = 3.4, FOCAL = 540 / Math.tan((16 * Math.PI) / 180);
/** screen point (430x932 space) on a phone that faces the camera → frame pixels */
function proj(p: P3, u: number, v: number) {
  const lx = (u / 430 - 0.5) * SCR_W * p.s, ly = (0.5 - v / 932) * SCR_H * p.s;
  const k = FOCAL / (CAM_Z - p.z);
  return { x: 960 + (p.x + lx) * k, y: 540 - (p.y + ly) * k, k };
}
/** a clip's frame on the phone, held at its ends */
const scr = (clip: string, n: number, len: number) => staticFile(`scr/${clip}/${String(Math.max(0, Math.min(len - 1, Math.round(n)))).padStart(4, "0")}.png`);
const LEN: Record<string, number> = { track: 1,  chat_group: 210, chat_list: 210, chat_office: 210, orders: 50, details: 40, table: 176, method: 132, receipt: 116, share: 164, friend: 195 };

/* ================= type ================= */
/** letters fade in from a blur, one after another (the references' reveal) */
function Letters({ text, at, size, y, x, align = "center", weight = 300, color = INK, accent, out, per = 1.2, track: tr = -0.02 }:
  { text: string; at: number; size: number; y: number; x?: number; align?: "center" | "left"; weight?: number; color?: string; accent?: string[]; out?: number; per?: number; track?: number }) {
  const f = useCurrentFrame();
  const leave = out === undefined ? 0 : ramp(f, out, out + 10);
  let i = 0;
  const words = text.split(" ");
  return (
    <div style={{ position: "absolute", left: align === "center" ? 0 : x, right: align === "center" ? 0 : undefined, top: y - size * 0.62, display: "flex", justifyContent: align === "center" ? "center" : "flex-start", gap: size * 0.24, fontFamily: "Figtree", fontWeight: weight, fontSize: size, lineHeight: 1.15, letterSpacing: size * tr, whiteSpace: "nowrap" }}>
      {words.map((w, wi) => {
        const acc = accent && accent.includes(w.replace(/[.,?!]/g, ""));
        return (
          <span key={wi} style={{ display: "flex", color: acc ? ACCENT : color, fontWeight: acc ? Math.max(weight, 500) : weight }}>
            {w.split("").map((ch, ci) => {
              const t = ramp(f, at + (i++) * per, at + i * per + 9, easeOut);
              return <span key={ci} style={{ opacity: t * (1 - leave), filter: `blur(${((1 - t) * 10 + leave * 10).toFixed(1)}px)` }}>{ch}</span>;
            })}
          </span>
        );
      })}
    </div>
  );
}
/** typed with a blinking cursor */
function Typed({ text, at, size, y, per = 2, out }: { text: string; at: number; size: number; y: number; per?: number; out?: number }) {
  const f = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor((f - at) / per)));
  const done = n >= text.length;
  const blink = done ? (Math.floor(f / 12) % 2 === 0 ? 1 : 0) : 1;
  const leave = out === undefined ? 0 : ramp(f, out, out + 10);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y - size * 0.62, display: "flex", justifyContent: "center", fontFamily: "Figtree", fontWeight: 300, fontSize: size, letterSpacing: -size * 0.02, color: INK, opacity: 1 - leave, filter: `blur(${(leave * 10).toFixed(1)}px)`, whiteSpace: "pre" }}>
      <span>{text.slice(0, n)}</span>
      <span style={{ width: 4, height: size * 0.95, marginLeft: 6, background: ORANGE, opacity: f >= at ? blink : 0, alignSelf: "center" }} />
    </div>
  );
}

/* ================= cursor + pop-outs (2D over the 3D) ================= */
type Tap = { at: number; x: number; y: number };
function Cursor({ taps, f, enter, exit }: { taps: Tap[]; f: number; enter: number; exit: number }) {
  if (f < enter - 2 || f > exit + 12 || !taps.length) return null;
  let x = taps[0].x + 260, y = taps[0].y + 240;
  const start = { x, y };
  for (let i = 0; i < taps.length; i++) {
    const a = i === 0 ? enter : taps[i - 1].at + 4, b = taps[i].at - 2;
    const from = i === 0 ? start : taps[i - 1];
    if (f >= a) { const t = ramp(f, a, b); x = mix(from.x, taps[i].x, t); y = mix(from.y, taps[i].y, t); }
  }
  const last = taps[taps.length - 1];
  if (f > last.at + 4) { const t = ramp(f, last.at + 6, exit + 10); x = mix(last.x, last.x + 220, t); y = mix(last.y, last.y + 260, t); }
  const press = taps.reduce((m, p) => Math.max(m, f >= p.at - 3 && f <= p.at + 5 ? 1 - Math.abs(f - p.at) / 5 : 0), 0);
  const vis = ramp(f, enter - 2, enter + 6) * (1 - ramp(f, exit, exit + 10));
  return (
    <>
      {taps.map((p, i) => { const t = clamp01((f - p.at) / 16); return f >= p.at && t < 1 ? <div key={i} style={{ position: "absolute", left: p.x - 46, top: p.y - 46, width: 92, height: 92, borderRadius: 46, border: `5px solid ${ORANGE}`, opacity: (1 - t) * 0.8, transform: `scale(${(0.3 + t * 0.9).toFixed(2)})` }} /> : null; })}
      <svg width="56" height="64" viewBox="0 0 28 32" style={{ position: "absolute", left: x - 9, top: y - 4, opacity: vis, transform: `scale(${(1 - press * 0.14).toFixed(3)})` }}>
        <path d="M7 2.5c0-1.4 1.1-2.5 2.5-2.5S12 1.1 12 2.5V12l1.2-.3c1.2-.3 2.4.4 2.8 1.6l.1.3.9-.2c1.2-.3 2.4.4 2.8 1.6l.1.3.8-.1c1.4-.2 2.6.8 2.8 2.2l.7 5.8c.4 3.3-1.4 6.5-4.4 7.9l-1.6.7c-2.7 1.2-5.9.5-7.8-1.8L2.5 21.4c-.9-1.1-.8-2.7.2-3.6 1-1 2.6-1 3.6 0l.7.7Z" fill="#FFFFFF" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12 12v6M16.1 13.6V18M20 15.5V19" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </>
  );
}
type Pop = { at: number; still: string; box: { x: number; y: number; w: number; h: number }; dx: number; dy: number; k: number; hit: [number, number] };
const POP_LIFT = 12, POP_CLICK = 22, POP_BACK = 32;
function popGeom(p: Pop, ph: P3) {
  const c = proj(ph, p.box.x + p.box.w / 2, p.box.y + p.box.h / 2);
  const px = (SCR_W / 430) * ph.s * c.k; // frame px per screen px
  return { cx: c.x, cy: c.y, w: p.box.w * px, h: p.box.h * px, px };
}
function popClick(p: Pop, ph: P3) {
  const g = popGeom(p, ph);
  return { x: g.cx + p.dx + (p.hit[0] - p.box.w / 2) * g.px * p.k, y: g.cy + p.dy + (p.hit[1] - p.box.h / 2) * g.px * p.k };
}
function PopOut({ p, ph, f }: { p: Pop; ph: P3; f: number }) {
  const l = f - p.at;
  if (l < 0 || l > POP_BACK + 2) return null;
  const t = ramp(l, 0, POP_LIFT, backOut) * (1 - ramp(l, POP_CLICK + 2, POP_BACK));
  const press = l >= POP_CLICK - 2 && l <= POP_CLICK + 3 ? 1 - Math.abs(l - POP_CLICK) / 3 : 0;
  const g = popGeom(p, ph);
  const k = 1 + (p.k - 1) * t - press * 0.05;
  return (
    <>
      <div style={{ position: "absolute", left: g.cx - g.w / 2, top: g.cy - g.h / 2, width: g.w, height: g.h, borderRadius: 14 * g.px, background: "rgba(65,19,21,0.10)", opacity: clamp01(t * 1.4) }} />
      <div style={{ position: "absolute", left: g.cx - g.w / 2, top: g.cy - g.h / 2, width: g.w, height: g.h, borderRadius: 16 * g.px, overflow: "hidden", background: "#FFFFFF",
        boxShadow: `0 ${(40 * t).toFixed(0)}px ${(70 * t).toFixed(0)}px rgba(65,19,21,${(0.28 * t).toFixed(2)}), 0 0 0 ${(2 * t).toFixed(1)}px rgba(255,90,0,${(0.35 * t).toFixed(2)})`,
        transform: `translate(${(p.dx * t).toFixed(1)}px, ${(p.dy * t).toFixed(1)}px) scale(${k.toFixed(3)})` }}>
        <Img src={staticFile(`pops/${p.still}.png`)} style={{ position: "absolute", left: -p.box.x * g.px, top: -p.box.y * g.px, width: 430 * g.px, height: 932 * g.px }} />
      </div>
    </>
  );
}

/* ================= side copy ================= */
function Side({ x, a, b, at, out, accent }: { x: number; a: string; b?: string; at: number; out: number; accent?: string[] }) {
  const f = useCurrentFrame();
  const leave = ramp(f, out, out + 10);
  let i = 0;
  const L = (s: string, weight: number, color: string, start: number, per: number, acc?: string[]) => s.split(" ").map((w, wi) => {
    const isA = acc && acc.includes(w.replace(/[.,?!]/g, ""));
    return (
      <span key={wi} style={{ display: "flex", color: isA ? ACCENT : color, fontWeight: isA ? 500 : weight }}>
        {w.split("").map((ch, ci) => { const t = ramp(f, start + (i++) * per, start + i * per + 9, easeOut); return <span key={ci} style={{ opacity: t * (1 - leave), filter: `blur(${((1 - t) * 10 + leave * 10).toFixed(1)}px)` }}>{ch}</span>; })}
      </span>
    );
  });
  return (
    <div style={{ position: "absolute", left: x, top: 0, height: 1080, width: 640, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22, fontFamily: "Figtree" }}>
      <div style={{ display: "flex", flexWrap: "wrap", columnGap: 18, rowGap: 2, fontSize: 74, lineHeight: 1.08, letterSpacing: -2 }}>{L(a, 300, INK, at, 0.8, accent)}</div>
      {b ? <div style={{ display: "flex", flexWrap: "wrap", columnGap: 9, fontSize: 34, lineHeight: 1.3 }}>{(i = 0, L(b, 400, "#5A5A5A", at + 16, 0.4))}</div> : null}
    </div>
  );
}

/* ================= backgrounds ================= */
function Rings({ o }: { o: number }) {
  return (
    <AbsoluteFill style={{ opacity: o }}>
      {[900, 680, 470, 280].map((r, i) => (
        <div key={i} style={{ position: "absolute", left: 960 - r, top: 540 - r, width: r * 2, height: r * 2, borderRadius: r, boxShadow: `inset 0 0 ${60 + i * 20}px rgba(120,95,80,0.10), 0 0 80px rgba(255,255,255,0.9)` }} />
      ))}
    </AbsoluteFill>
  );
}
function Wash({ o }: { o: number }) {
  return <AbsoluteFill style={{ opacity: o, background: `linear-gradient(180deg, ${BG} 0%, ${BG} 38%, #FFD9C2 72%, ${ORANGE} 118%)` }} />;
}

/* ================= the film ================= */
const SH = 168; // the app flow sits 168 frames later than in cut 3
const LEFT_X = 170, RIGHT_X = 1110;
const XR = 0.6, XL = -0.58;

function Film() {
  const f = useCurrentFrame();

  /* ---- phones ---- */
  // P0: the group chat in the problem, then the app through the whole flow
  let p0: P3 = HIDE, p0src = scr("orders", 0, 50);
  if (f >= 418 && f < 1316) {
    const g = f - SH; // cut-3 timeline
    p0 = {
      x: track(g, [[250, 0.2], [262, XR], [520, XR], [548, XL], [775, XL], [803, XR], [940, XR], [968, XL], [1108, XL], [1140, -0.1]]),
      y: track(g, [[250, -2.1], [266, 0], [312, 0], [350, -0.07], [512, -0.07], [528, 0], [536, -0.25], [548, 0], [1028, 0], [1040, 0.42], [1095, 0.42], [1108, 0], [1140, -2.4]]),
      z: track(g, [[250, -0.6], [266, 0], [312, 0], [350, 0.55], [512, 0.55], [530, 0], [660, 0], [700, 0.35], [766, 0.35], [790, -0.2], [803, 0], [1028, 0], [1040, 0.6], [1095, 0.6], [1108, 0]]),
      rx: track(g, [[250, 1.15], [268, 0], [528, 0], [536, 0.45], [548, 0], [940, 0], [954, 0.7], [968, 0], [1108, 0], [1140, 1.2]]),
      ry: g >= 776 && g < 803 ? (g < 789 ? mix(0, -1.45, ramp(g, 776, 789, easeIn)) : mix(1.45, 0, ramp(g, 790, 803, easeOut))) : track(g, [[250, -0.4], [270, 0], [660, 0], [676, -0.22], [700, 0]]),
      rz: track(g, [[250, -0.35], [268, 0], [528, 0], [536, -0.12], [548, 0], [940, 0], [954, 0.15], [968, 0], [1108, 0], [1140, -0.5]]),
      s: 1,
    };
    const clips: [string, number][] = [["orders", 262], ["details", 312], ["table", 352], ["method", 528], ["receipt", 660], ["share", 776], ["friend", 940]];
    let cur = clips[0];
    for (const c of clips) if (g >= c[1]) cur = c;
    p0src = scr(cur[0], g - cur[1], LEN[cur[0]]);
  }
  // P1 / P2: more people, more chats (the problem)
  let p1: P3 = HIDE, p2: P3 = HIDE, p3: P3 = HIDE;
  let p1src = scr("table", 0, 176), p2src = scr("receipt", 0, 116), p3src = scr("orders", 0, 50);
  // the closing fan (cut 1's ending): seven phones in an angled row, rising in and drifting left
  const fan: P3[] = [HIDE, HIDE, HIDE, HIDE, HIDE, HIDE, HIDE];
  const fanSrc = [scr("orders", 0, 50), scr("table", 175, 176), scr("method", 131, 132), scr("receipt", 60, 116), scr("share", 163, 164), scr("friend", 194, 195), scr("track", 0, 1)];
  if (f >= 1540 && f < 1645) {
    const l = f - 1540, PX = FOCAL / CAM_Z, drift = l * 1.6;
    for (let i = 0; i < 7; i++) {
      const k = i - 3, t = ramp(l, 4 + Math.abs(k) * 4, 22 + Math.abs(k) * 4, easeOut);
      const o = 1 - ramp(l, 92, 104);
      fan[i] = { x: (k * 300 + 60 - drift) / PX, y: -(Math.abs(k) * 28 + 40) / PX - (1 - t) * 1.2 - (1 - o) * 0.15, z: 0,
        rx: 0.1, ry: (-14 * k * Math.PI) / 180, rz: (-3 * k * Math.PI) / 180, s: (0.58 - Math.abs(k) * 0.035) * (t > 0.001 ? 1 : 0.001) };
    }
  }

  /* ---- taps and pop-outs on P0 (the cut-3 schedule, shifted) ---- */
  const pops: Pop[] = [
    { at: 280 + SH, still: "orders", box: { x: 18, y: 390, w: 394, h: 53 }, dx: -260, dy: 10, k: 1.5, hit: [300, 26] },
    { at: 440 + SH, still: "table", box: { x: 17, y: 656, w: 396, h: 81 }, dx: -260, dy: -40, k: 1.25, hit: [362, 40] },
    { at: 812 + SH, still: "share", box: { x: 17, y: 508, w: 396, h: 124 }, dx: -260, dy: -30, k: 1.4, hit: [335, 36] },
    { at: 980 + SH, still: "friend", box: { x: 17, y: 780, w: 396, h: 56 }, dx: 260, dy: -60, k: 1.45, hit: [198, 28] },
  ];
  const onPhone = (at: number, u: number, v: number): Tap => ({ at, ...proj(p0, u, v) });
  const taps: Tap[] = [
    { at: pops[0].at + POP_CLICK, ...popClick(pops[0], p0) }, onPhone(338 + SH, 345, 290),
    onPhone(390 + SH, 51, 584), onPhone(422 + SH, 125, 584), { at: pops[1].at + POP_CLICK, ...popClick(pops[1], p0) }, onPhone(505 + SH, 215, 871),
    onPhone(580 + SH, 215, 140), onPhone(624 + SH, 84, 140),
    onPhone(710 + SH, 290, 572), onPhone(746 + SH, 290, 572),
    { at: pops[2].at + POP_CLICK, ...popClick(pops[2], p0) },
    { at: pops[3].at + POP_CLICK, ...popClick(pops[3], p0) }, onPhone(1046 + SH, 215, 870),
  ];
  const spans: [number, number][] = [[276 + SH, 515 + SH], [560 + SH, 762 + SH], [808 + SH, 930 + SH], [976 + SH, 1062 + SH]];

  /* ---- background states ---- */
  const ringsO = ramp(f, 296, 312) * (1 - ramp(f, 340, 352));
  const washO = ramp(f, 340, 352) * (1 - ramp(f, 404, 424));
  const greyO = 0;

  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      <style>{FONTS}</style>
      <Rings o={ringsO} />
      <Wash o={washO} />
      <AbsoluteFill style={{ background: "#EDE9E4", opacity: greyO }} />

      <Canvas3D layered>
        <Camera3d transform={Transform.fromXyz(0, 0, CAM_Z).lookingAt([0, 0, 0])} projection={{ Perspective: { fov: (32 * Math.PI) / 180 } }} />
        <ToneMapping mode="none" />
        <AmbientLight brightness={300} />
        <DirectionalLight transform={Transform.fromXyz(2, 3, 4).lookingAt([0, 0, 0])} illuminance={9000} />
        <DirectionalLight transform={Transform.fromXyz(-3, 1, 2).lookingAt([0, 0, 0])} illuminance={3500} />
        <Phone3D id="p0" src={p0src} p={p0} />
        <Phone3D id="p1" src={p1src} p={p1} />
        <Phone3D id="p2" src={p2src} p={p2} />
        <Phone3D id="p3" src={p3src} p={p3} />
        {fan.map((fp, i) => <Phone3D key={i} id={"fan" + i} src={fanSrc[i]} p={fp} />)}
      </Canvas3D>

      {/* ---- 0 · the question, typed ---- */}
      {f < 80 ? <Typed text="Ordered dinner for the group?" at={6} size={84} y={540} per={1.6} out={64} /> : null}

      {/* ---- 1 · the problem: the group chat, floating up the page ---- */}
      {f >= 80 && f < 300 ? <Bubbles f={f} /> : null}
      {f >= 258 && f < 304 ? <Missing f={f - 258} /> : null}

      {/* ---- 2 · stop chasing ---- */}
      {f >= 300 && f < 352 ? <BigZoom f={f} /> : null}

      {/* ---- 3 · meet ---- */}
      {f >= 344 && f < 428 ? <Meet f={f} /> : null}

      {/* ---- 4 · the flow beside the phone ---- */}
      {f >= 262 + SH && f < 352 + SH ? <Side x={LEFT_X} a="Right from your order." b="Delivered? Tap Split the bill." at={268 + SH} out={342 + SH} accent={["order"]} /> : null}
      {f >= 352 + SH && f < 440 + SH ? <Side x={LEFT_X} a="Pick who ate." b="Tap your contacts. The table fills up." at={358 + SH} out={434 + SH} accent={["ate"]} /> : null}
      {f >= 440 + SH && f < 528 + SH ? <Side x={LEFT_X} a="Not on talabat? Add a guest." b="Each guest gets their own link." at={446 + SH} out={518 + SH} accent={["guest"]} /> : null}
      {f >= 548 + SH && f < 660 + SH ? <Side x={RIGHT_X} a="By item, equally or custom." b="Shares update as you tap." at={556 + SH} out={650 + SH} accent={["item"]} /> : null}
      {f >= 660 + SH && f < 776 + SH ? <Side x={RIGHT_X} a="Everyone gets their receipt." b="Fees and the pro discount, shared fairly." at={668 + SH} out={766 + SH} accent={["receipt"]} /> : null}
      {f >= 803 + SH && f < 940 + SH ? <Side x={LEFT_X} a="Guests join with a link." b="Their name appears the moment they log in." at={808 + SH} out={930 + SH} accent={["link"]} /> : null}
      {f >= 968 + SH && f < 1135 + SH ? <Side x={RIGHT_X} a="Pay now with talabat." b="It lands in Hamza’s talabat credit, not a bank account." at={1012 + SH} out={1124 + SH} accent={["talabat"]} /> : null}

      {pops.map((p, i) => <PopOut key={i} p={p} ph={p0} f={f} />)}
      {f >= 418 && f < 1316 ? spans.map(([a, b], i) => <Cursor key={i} f={f} enter={a} exit={b} taps={taps.filter((t) => t.at > a && t.at < b)} />) : null}

      {/* ---- 5 · why pay inside talabat ---- */}
      {f >= 1316 && f < 1446 ? <Why f={f - 1316} /> : null}

      {/* ---- 6 · all settled ---- */}
      {f >= 1446 && f < 1540 ? <Settled f={f - 1446} /> : null}

      {/* ---- 7 · tunnel line ---- */}
      {f >= 1550 && f < 1645 ? <Letters text="One order. Everyone square." at={1556} size={84} y={200} weight={300} accent={["Everyone", "square"]} out={1630} per={0.8} /> : null}

      {/* ---- 8 · end ---- */}
      {f >= 1645 ? <End f={f - 1645} /> : null}
    </AbsoluteFill>
  );
}


/* ================= the problem: messages that float up the page ================= */
type Msg = { at: number; who: "you" | "omar" | "sara" | "ali"; text: string; x: number };
export const MSGS: Msg[] = [
  { at: 84, who: "you", text: "Total is AED 125. I\u2019ll tell everyone their share shortly.", x: 560 },
  { at: 106, who: "you", text: "Omar 35.55 \u00b7 Sara 26.95 \u00b7 Ali 30.39", x: 980 },
  { at: 126, who: "sara", text: "Wait, I only had a salad", x: 300 },
  { at: 142, who: "omar", text: "why is mine 35?", x: 1340 },
  { at: 158, who: "you", text: "Omar: wings + fries. Sara: wrap + fries. Ali: strips + fries.", x: 640 },
  { at: 176, who: "ali", text: "ok will send later", x: 1220 },
  { at: 190, who: "you", text: "Reminder: please send the money", x: 380 },
  { at: 202, who: "omar", text: "Sent.", x: 1420 },
  { at: 212, who: "you", text: "Sara? Ali?", x: 860 },
  { at: 222, who: "you", text: "Reminder again, please send", x: 1180 },
  { at: 231, who: "ali", text: "Friday", x: 420 },
  { at: 239, who: "you", text: "Guys??", x: 1000 },
  { at: 246, who: "you", text: "Still waiting\u2026", x: 640 },
];
const WHO = { omar: ["Omar", "#C83F00", "av-omar.svg"], sara: ["Sara", "#7A3EB1", "av-sara.svg"], ali: ["Ali", "#1F7A4D", "av-ali.svg"] } as const;
function Bubbles({ f }: { f: number }) {
  const fadeAll = 1 - ramp(f, 252, 266);
  return (
    <AbsoluteFill style={{ opacity: fadeAll }}>
      {MSGS.map((m, i) => {
        const l = f - m.at;
        if (l < 0) return null;
        const rise = 150 - Math.min(60, i * 5);                // later messages rise faster
        const t = l / rise;
        const y = mix(1180, -260, t);
        const pop = ramp(l, 0, 10, backOut);
        const depth = 0.86 + ((i * 37) % 10) / 50;            // a little parallax
        const o = clamp01(l / 6) * (1 - clamp01((t - 0.82) / 0.18));
        const out = m.who === "you";
        const who = out ? null : WHO[m.who];
        return (
          <div key={i} style={{ position: "absolute", left: m.x - 230, top: y, width: 460, display: "flex", justifyContent: out ? "flex-end" : "flex-start", opacity: o, transform: `scale(${(depth * (0.7 + 0.3 * pop)).toFixed(3)})`, filter: depth < 0.9 ? "blur(1px)" : "none" }}>
            <div style={{ maxWidth: 460, padding: "16px 22px 12px", borderRadius: 26, borderTopRightRadius: out ? 8 : 26, borderTopLeftRadius: out ? 26 : 8, background: out ? "#D9FDD3" : "#FFFFFF", boxShadow: "0 14px 34px rgba(65,19,21,0.12), 0 2px 4px rgba(0,0,0,0.06)", fontFamily: "Figtree", color: "#111" }}>
              {who ? <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 21, fontWeight: 700, color: who[1], marginBottom: 4 }}><div style={{ width: 28, height: 28, borderRadius: 14, overflow: "hidden" }}><Img src={staticFile(who[2])} style={{ width: "100%", height: "100%" }} /></div>{who[0]}</div> : null}
              <div style={{ fontSize: 28, lineHeight: 1.3, fontWeight: 400 }}>{m.text}</div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4, fontSize: 17, color: "#8A8A8A" }}>{`9:${String(14 + i).padStart(2, "0")}`}{out ? <span style={{ color: "#53BDEB", fontWeight: 700 }}>✓✓</span> : null}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
/* what never came back */
function Missing({ f }: { f: number }) {
  const o = ramp(f, 4, 12) * (1 - ramp(f, 36, 46));
  const n = 57.34 * ramp(f, 6, 24, easeOut);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 360, textAlign: "center", fontFamily: "Figtree", fontWeight: 400, fontSize: 150, letterSpacing: -4, color: ACCENT }}>AED {n.toFixed(2)}</div>
      <Letters text="never came back." at={258 + 10} size={64} y={600} weight={300} per={0.8} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 680, display: "flex", justifyContent: "center", gap: 28, fontFamily: "Figtree", fontSize: 28, color: "#5A5A5A" }}>
        {[["av-sara.svg", "Sara · 26.95"], ["av-ali.svg", "Ali · 30.39"]].map(([a, t], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px 10px 10px", borderRadius: 40, background: "#FFFFFF", boxShadow: "0 10px 24px rgba(65,19,21,0.08)", opacity: ramp(f, 14 + i * 4, 22 + i * 4) }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, overflow: "hidden" }}><Img src={staticFile(a)} style={{ width: "100%", height: "100%" }} /></div>{t}<span style={{ color: ACCENT, fontWeight: 600 }}>unpaid</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
}

/* "chasing" huge, then pulled back to "Stop chasing." */
function BigZoom({ f }: { f: number }) {
  const l = f - 300;
  const z = mix(7.5, 1, ramp(l, 0, 26, easeOut));
  const o = ramp(l, 0, 4) * (1 - ramp(l, 42, 52));
  const stop = ramp(l, 22, 32, easeOut);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 540 - 70, display: "flex", justifyContent: "center", alignItems: "baseline", gap: 30, fontFamily: "Figtree", fontSize: 120, letterSpacing: -3, lineHeight: 1.15 }}>
        <span style={{ fontWeight: 300, color: "#7A7A7A", opacity: stop, filter: `blur(${((1 - stop) * 12).toFixed(1)}px)` }}>Stop</span>
        <span style={{ fontWeight: 400, color: INK, transform: `scale(${z.toFixed(3)})`, filter: `blur(${(Math.max(0, z - 1) * 1.6).toFixed(1)}px)` }}>chasing.</span>
      </div>
    </AbsoluteFill>
  );
}

/* "Meet" big, then "Meet Split the bill", then the line under it */
function Meet({ f }: { f: number }) {
  const l = f - 344;
  const s = mix(2.6, 1, ramp(l, 0, 18, easeOut));
  const slide = ramp(l, 18, 34, easeOut);
  const o = ramp(l, 0, 6) * (1 - ramp(l, 72, 84));
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 420, display: "flex", justifyContent: "center", alignItems: "center", gap: 28 * slide, fontFamily: "Figtree", fontSize: 112, letterSpacing: -3 }}>
        <span style={{ fontWeight: 400, color: INK, transform: `scale(${s.toFixed(3)})`, filter: `blur(${((s - 1) * 8).toFixed(1)}px)` }}>Meet</span>
        <span style={{ display: "flex", overflow: "hidden", maxWidth: 720 * slide }}>
          <span style={{ padding: "14px 44px", borderRadius: 999, background: ORANGE, color: "#FFFFFF", fontWeight: 800, fontSize: 96, letterSpacing: -2, whiteSpace: "nowrap", transform: `translateX(${((1 - slide) * -80).toFixed(0)}px)`, boxShadow: "0 24px 50px rgba(255,90,0,0.25)" }}>Split the bill</span>
        </span>
      </div>
      <Letters text="Split any order with friends, right inside talabat." at={384} size={40} y={640} weight={400} color="#4A4A4A" per={0.5} />
    </AbsoluteFill>
  );
}

function Why({ f }: { f: number }) {
  const o = ramp(f, 0, 10) * (1 - ramp(f, 118, 130));
  const cards = [
    { t: "The money stays in talabat", d: "Paid back as credit, spent on the next order.", icon: "wallet" },
    { t: "Every friend gets the app", d: "To pay in talabat, they download it.", icon: "app" },
    { t: "More orders, more revenue", d: "Wallet credit brings people back.", icon: "bag" },
  ];
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <Letters text="Why pay inside talabat?" at={1316 + 2} size={88} y={230} weight={300} accent={["inside", "talabat?"]} per={0.8} />
      <div style={{ position: "absolute", left: 150, right: 150, top: 380, display: "flex", gap: 40 }}>
        {cards.map((c, i) => {
          const t = ramp(f, 24 + i * 16, 44 + i * 16, backOut), a = clamp01(ramp(f, 24 + i * 16, 32 + i * 16));
          return (
            <div key={i} style={{ flex: 1, height: 420, borderRadius: 36, background: "#FFFFFF", boxShadow: "0 30px 60px rgba(65,19,21,0.10)", padding: 44, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 22, opacity: a, transform: `translateY(${((1 - t) * 80).toFixed(1)}px)` }}>
              <div style={{ width: 104, height: 104, borderRadius: 30, background: "#FFF1E8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {c.icon === "wallet" ? <svg width="64" height="54" viewBox="0 0 40 34"><path d="M6 8L26 2l4 6" fill={ORANGE} /><rect x="2" y="7" width="36" height="25" rx="5" fill="#411315" /><rect x="24" y="14" width="14" height="11" rx="3.5" fill={ORANGE} /><circle cx="30" cy="19.5" r="2.2" fill="#FFF3EA" /></svg> : null}
                {c.icon === "app" ? <svg width="56" height="64" viewBox="0 0 28 32"><rect x="3" y="1" width="22" height="30" rx="5" fill="#411315" /><rect x="6" y="5" width="16" height="20" rx="2" fill="#FFF3EA" /><path d="M14 8v10M10 14l4 4 4-4" stroke={ORANGE} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
                {c.icon === "bag" ? <svg width="60" height="60" viewBox="0 0 40 40"><path d="M8 14h24l-2.2 22H10.2Z" fill={ORANGE} /><path d="M14 14v-3a6 6 0 0 1 12 0v3" fill="none" stroke="#411315" strokeWidth="3.2" strokeLinecap="round" /><path d="M14 27l4-4 3 3 5-6" stroke="#FFF3EA" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
              </div>
              <div style={{ fontFamily: "Figtree", fontWeight: 500, fontSize: 44, lineHeight: 1.1, color: INK, letterSpacing: -1 }}>{c.t}</div>
              <div style={{ fontFamily: "Figtree", fontWeight: 400, fontSize: 29, lineHeight: 1.3, color: "#4A4A4A" }}>{c.d}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function Settled({ f }: { f: number }) {
  const t = ramp(f, 0, 16, backOut), o = ramp(f, 0, 6) * (1 - ramp(f, 82, 94));
  const cols = [ORANGE, "#411315", "#FFB800", "#FFD9C2", "#17803A"];
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <Letters text="All settled." at={1446} size={120} y={360} weight={300} accent={["settled"]} per={1.2} />
      <div style={{ position: "absolute", left: 870, top: 520, width: 180, height: 180, borderRadius: 90, background: "#FFFFFF", boxShadow: "0 30px 70px rgba(23,128,58,0.22)", transform: `scale(${(0.3 + 0.7 * t).toFixed(3)})`, opacity: clamp01(ramp(f, 0, 6)), display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="110" height="110" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#17803A" /><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="16" strokeDashoffset={(16 * (1 - ramp(f, 8, 22))).toFixed(2)} /></svg>
      </div>
      {f > 4 ? Array.from({ length: 46 }).map((_, i) => {
        const tt = f - 4, r1 = ((i * 97) % 101) / 101, r2 = ((i * 53) % 89) / 89, r3 = ((i * 31) % 61) / 61;
        const ang = r1 * Math.PI * 2, sp = 14 + r2 * 18, s = 14 + r3 * 18;
        return <div key={i} style={{ position: "absolute", left: 960 + Math.cos(ang) * sp * tt * 1.1, top: 610 + Math.sin(ang) * sp * tt * 0.8 + 0.35 * tt * tt, width: s, height: s * 0.6, borderRadius: i % 3 === 0 ? s : 3, background: cols[i % 5], opacity: 1 - clamp01((tt - 40) / 30), transform: `rotate(${(r1 * 360 + tt * (6 + r2 * 10)).toFixed(0)}deg)` }} />;
      }) : null}
    </AbsoluteFill>
  );
}

function End({ f }: { f: number }) {
  const t = ramp(f, 0, 18, backOut);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: ramp(f, 0, 20), background: `linear-gradient(180deg, ${BG} 0%, ${BG} 45%, #FFD9C2 85%, #FFB38A 120%)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, display: "flex", justifyContent: "center", opacity: clamp01(ramp(f, 0, 8)) }}>
        <div style={{ padding: "24px 60px", borderRadius: 999, background: ORANGE, color: "#FFFFFF", fontFamily: "Figtree", fontWeight: 800, fontSize: 100, letterSpacing: -2, lineHeight: 1, transform: `scale(${(0.7 + 0.3 * t).toFixed(3)})`, boxShadow: "0 30px 60px rgba(255,90,0,0.25)" }}>Split the bill</div>
      </div>
      <Letters text="A feature concept for talabat" at={1645 + 14} size={48} y={610} weight={400} per={0.6} />
      <Letters text="Designed by Hamza" at={1645 + 30} size={34} y={700} weight={400} color="#5A5A5A" accent={["Hamza"]} per={0.6} />
    </AbsoluteFill>
  );
}

registerRoot(() => <Composition id="split-the-bill-v5" component={Film} width={1920} height={1080} fps={FPS} durationInFrames={1745} />);
