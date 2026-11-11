import { AbsoluteFill, Composition, Img, Sequence, Video, registerRoot, staticFile, useCurrentFrame } from "raea";

/* ---------- tokens ---------- */
const ORANGE = "#FF5A00";
const ACCENT = "#D64500"; // orange for text on cream (passes 3:1+)
const INK = "#1F1F1F";
const MAROON = "#411315";
const BG = "#FBF8F5";
const FONTS = [500, 700, 800, 900]
  .map((w) => `@font-face{font-family:Figtree;font-weight:${w};src:url(${staticFile(`fonts/figtree-${w}.ttf`)})}`)
  .join("");

/* ---------- easing + keyframes ---------- */
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const backOut = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const ramp = (f: number, a: number, b: number, ease = easeInOut) => ease(clamp01((f - a) / (b - a)));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
/** keyframes [[frame, value], ...] eased between each pair */
function track(f: number, k: [number, number][]) {
  if (f <= k[0][0]) return k[0][1];
  for (let i = 0; i < k.length - 1; i++) {
    const [f0, v0] = k[i], [f1, v1] = k[i + 1];
    if (f <= f1) return mix(v0, v1, easeInOut(clamp01((f - f0) / (f1 - f0))));
  }
  return k[k.length - 1][1];
}

/* ---------- kinetic type: words blur in one by one ---------- */
type W = { t: string; at: number; c?: string };
function Words({ words, size, out, y = 540, x, align = "center", weight = 800 }: { words: W[]; size: number; out?: number; y?: number; x?: number; align?: "center" | "left"; weight?: number }) {
  const f = useCurrentFrame();
  const leave = out === undefined ? 0 : ramp(f, out, out + 10);
  const style: any = align === "center"
    ? { position: "absolute", left: 0, right: 0, top: y - size * 0.6, display: "flex", justifyContent: "center", gap: size * 0.26 }
    : { position: "absolute", left: x, width: 680, top: y - size * 0.6, display: "flex", flexWrap: "wrap", columnGap: size * 0.26, rowGap: size * 0.08 };
  return (
    <div style={{ ...style, fontFamily: "Figtree", fontWeight: weight, fontSize: size, lineHeight: 1.12, letterSpacing: -size * 0.02 }}>
      {words.map((w, i) => {
        const t = ramp(f, w.at, w.at + 10, easeOut);
        const blur = (1 - t) * 14 + leave * 14;
        return (
          <span key={i} style={{ color: w.c ?? INK, opacity: t * (1 - leave), filter: `blur(${blur.toFixed(1)}px)`, transform: `translateY(${((1 - t) * 18 - leave * 12).toFixed(1)}px)` }}>{w.t}</span>
        );
      })}
    </div>
  );
}
const words = (s: string, at: number, gap = 5, c?: (i: number, w: string) => string | undefined): W[] =>
  s.split(" ").map((t, i) => ({ t, at: at + i * gap, c: c ? c(i, t) : undefined }));

/* ---------- phone: one device that moves through the whole film ---------- */
const SW = 430, SH = 932, BORDER = 12;
type Shot = { src: string; at: number };
function screenAt(shots: Shot[], f: number) {
  // returns layers with opacities (crossfade 6 frames)
  return shots.map((s, i) => {
    const next = shots[i + 1];
    const inA = i === 0 ? 1 : ramp(f, s.at, s.at + 6, easeOut);
    const outA = next ? ramp(f, next.at + 6, next.at + 7) : 0;
    return { src: s.src, o: f < s.at && i > 0 ? 0 : inA * (1 - outA) };
  });
}
type Pose = { cx: number; cy: number; s: number; ry: number; rx: number; rz: number; o: number };
type Clip = { src: string; from: number; len: number };
function Phone({ pose, shots, f, clips = [] }: { pose: Pose; shots: Shot[]; f: number; clips?: Clip[] }) {
  const w = (SW + BORDER * 2) * pose.s, h = (SH + BORDER * 2) * pose.s;
  return (
    <div style={{ position: "absolute", left: pose.cx - w / 2, top: pose.cy - h / 2, width: w, height: h, opacity: pose.o,
      transform: `perspective(1800px) rotateY(${pose.ry}deg) rotateX(${pose.rx}deg) rotateZ(${pose.rz}deg)` }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: 66 * pose.s, background: "#121212", boxShadow: "0 50px 90px rgba(65,19,21,0.22), 0 10px 24px rgba(65,19,21,0.12)" }} />
      <div style={{ position: "absolute", left: BORDER * pose.s, top: BORDER * pose.s, width: SW * pose.s, height: SH * pose.s, borderRadius: 54 * pose.s, overflow: "hidden", background: "#fff" }}>
        {screenAt(shots, f).map((l, i) => l.o > 0.001 ? (
          <Img key={i} src={staticFile(`shots/${l.src}.png`)} style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", opacity: l.o }} />
        ) : null)}
        {clips.map((c) => f >= c.from && f < c.from + c.len ? (
          <Sequence key={c.src} from={c.from} durationInFrames={c.len} layout="none">
            <Video src={staticFile(`clips/${c.src}.mp4`)} muted style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }} />
          </Sequence>
        ) : null)}
        <div style={{ position: "absolute", left: "50%", top: 14 * pose.s, width: 120 * pose.s, height: 34 * pose.s, marginLeft: -60 * pose.s, borderRadius: 20 * pose.s, background: "#121212" }} />
      </div>
    </div>
  );
}
/** screen point (in 430x932 space) to frame coords for an upright phone */
const toFrame = (p: Pose, sx: number, sy: number) => {
  const w = (SW + BORDER * 2) * p.s, h = (SH + BORDER * 2) * p.s;
  return { x: p.cx - w / 2 + (BORDER + sx) * p.s, y: p.cy - h / 2 + (BORDER + sy) * p.s };
};

/* ---------- cursor with tap ripples ---------- */
type Tap = { at: number; sx: number; sy: number; fx?: number; fy?: number };
function Cursor({ taps, pose, f, enter, exit }: { taps: Tap[]; pose: Pose; f: number; enter: number; exit: number }) {
  if (f < enter - 2 || f > exit + 12 || taps.length === 0) return null;
  const pts = taps.map((t) => (t.fx !== undefined ? { x: t.fx, y: t.fy as number, at: t.at } : { ...toFrame(pose, t.sx, t.sy), at: t.at }));
  // travel: arrive at each tap 12 frames before it lands
  let x = pts[0].x + 260, y = pts[0].y + 240;
  const start = { x, y };
  for (let i = 0; i < pts.length; i++) {
    const a = i === 0 ? enter : pts[i - 1].at + 4;
    const b = pts[i].at - 2;
    const from = i === 0 ? start : pts[i - 1];
    if (f >= a) { const t = ramp(f, a, b); x = mix(from.x, pts[i].x, t); y = mix(from.y, pts[i].y, t); }
  }
  const last = pts[pts.length - 1];
  if (f > last.at + 4) { const t = ramp(f, last.at + 6, exit + 10); x = mix(last.x, last.x + 220, t); y = mix(last.y, last.y + 260, t); }
  const press = pts.reduce((m, p) => Math.max(m, f >= p.at - 3 && f <= p.at + 5 ? 1 - Math.abs(f - p.at) / 5 : 0), 0);
  const vis = ramp(f, enter - 2, enter + 6) * (1 - ramp(f, exit, exit + 10));
  return (
    <>
      {pts.map((p, i) => {
        const t = clamp01((f - p.at) / 16);
        return f >= p.at && t < 1 ? (
          <div key={i} style={{ position: "absolute", left: p.x - 46, top: p.y - 46, width: 92, height: 92, borderRadius: 46, border: `5px solid ${ORANGE}`, opacity: (1 - t) * 0.8, transform: `scale(${(0.3 + t * 0.9).toFixed(2)})` }} />
        ) : null;
      })}
      <svg width="56" height="64" viewBox="0 0 28 32" style={{ position: "absolute", left: x - 9, top: y - 4, opacity: vis, transform: `scale(${(1 - press * 0.14).toFixed(3)})` }}>
        <path d="M7 2.5c0-1.4 1.1-2.5 2.5-2.5S12 1.1 12 2.5V12l1.2-.3c1.2-.3 2.4.4 2.8 1.6l.1.3.9-.2c1.2-.3 2.4.4 2.8 1.6l.1.3.8-.1c1.4-.2 2.6.8 2.8 2.2l.7 5.8c.4 3.3-1.4 6.5-4.4 7.9l-1.6.7c-2.7 1.2-5.9.5-7.8-1.8L2.5 21.4c-.9-1.1-.8-2.7.2-3.6 1-1 2.6-1 3.6 0l.7.7Z" fill="#FFFFFF" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12 12v6M16.1 13.6V18M20 15.5V19" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </>
  );
}

/* ---------- scene copy beside the phone ---------- */
function Side({ x, a, b, at, out, accent }: { x: number; a: string; b?: string; at: number; out: number; accent?: string[] }) {
  const f = useCurrentFrame();
  const leave = ramp(f, out, out + 10);
  const word = (w: string, i: number, start: number, gap: number, color?: string) => {
    const t = ramp(f, start + i * gap, start + i * gap + 10, easeOut);
    return <span key={i} style={{ color, opacity: t * (1 - leave), filter: `blur(${((1 - t) * 14 + leave * 14).toFixed(1)}px)`, transform: `translateY(${((1 - t) * 18 - leave * 12).toFixed(1)}px)` }}>{w}</span>;
  };
  const isAcc = (w: string) => !!accent && accent.includes(w.replace(/[.,?]/g, ""));
  return (
    <div style={{ position: "absolute", left: x, top: 0, height: 1080, width: 640, display: "flex", flexDirection: "column", justifyContent: "center", gap: 28, fontFamily: "Figtree" }}>
      <div style={{ height: 6, width: 64, borderRadius: 3, background: ORANGE, opacity: ramp(f, at, at + 10) * (1 - leave) }} />
      <div style={{ display: "flex", flexWrap: "wrap", columnGap: 20, rowGap: 4, fontWeight: 800, fontSize: 76, lineHeight: 1.1, letterSpacing: -1.5, color: INK }}>
        {a.split(" ").map((w, i) => word(w, i, at, 4, isAcc(w) ? ACCENT : undefined))}
      </div>
      {b ? <div style={{ display: "flex", flexWrap: "wrap", columnGap: 10, rowGap: 2, fontWeight: 500, fontSize: 36, lineHeight: 1.3, color: "#4A4A4A", maxWidth: 600 }}>
        {b.split(" ").map((w, i) => word(w, i, at + 16, 2))}
      </div> : null}
    </div>
  );
}

/* ---------- confetti ---------- */
function Confetti({ at, f }: { at: number; f: number }) {
  if (f < at || f > at + 70) return null;
  const t = f - at;
  const cols = [ORANGE, MAROON, "#FFB800", "#FFD9C2", "#17803A"];
  return (
    <>
      {Array.from({ length: 46 }).map((_, i) => {
        const r1 = ((i * 97) % 101) / 101, r2 = ((i * 53) % 89) / 89, r3 = ((i * 31) % 61) / 61;
        const ang = r1 * Math.PI * 2, sp = 14 + r2 * 18;
        const x = 960 + Math.cos(ang) * sp * t * 1.1;
        const y = 560 + Math.sin(ang) * sp * t * 0.8 + 0.35 * t * t;
        const s = 14 + r3 * 18;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: s, height: s * 0.6, borderRadius: i % 3 === 0 ? s : 3, background: cols[i % cols.length], opacity: 1 - clamp01((t - 40) / 30), transform: `rotate(${(r1 * 360 + t * (6 + r2 * 10)).toFixed(0)}deg)` }} />;
      })}
    </>
  );
}

/* ---------- avatar (pixel art, people only) ---------- */
const Av = ({ n, size, x, y, o = 1, sc = 1 }: { n: string; size: number; x: number; y: number; o?: number; sc?: number }) => (
  <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2, overflow: "hidden", opacity: o, transform: `scale(${sc.toFixed(3)})`, boxShadow: "0 0 0 5px #FFFFFF, 0 14px 30px rgba(65,19,21,0.18)" }}>
    <Img src={staticFile(`av-${n}.svg`)} style={{ width: "100%", height: "100%" }} />
  </div>
);


/* ---------- pop-out: a UI element lifts off the screen, gets clicked, drops back ---------- */
type Pop = { at: number; still: string; box: { x: number; y: number; w: number; h: number }; dx: number; dy: number; k: number; hit: [number, number] };
const POP_LIFT = 12, POP_CLICK = 22, POP_BACK = 32;
function popGeom(p: Pop, pose: Pose) {
  const c = toFrame(pose, p.box.x + p.box.w / 2, p.box.y + p.box.h / 2);
  return { cx: c.x, cy: c.y, w: p.box.w * pose.s, h: p.box.h * pose.s };
}
function popClickPoint(p: Pop, pose: Pose) {
  const g = popGeom(p, pose);
  return { fx: g.cx + p.dx + (p.hit[0] - p.box.w / 2) * pose.s * p.k, fy: g.cy + p.dy + (p.hit[1] - p.box.h / 2) * pose.s * p.k };
}
function PopOut({ p, pose, f }: { p: Pop; pose: Pose; f: number }) {
  const l = f - p.at;
  if (l < 0 || l > POP_BACK + 2) return null;
  const up = ramp(l, 0, POP_LIFT, backOut), down = ramp(l, POP_CLICK + 2, POP_BACK);
  const t = up * (1 - down);
  const press = l >= POP_CLICK - 2 && l <= POP_CLICK + 3 ? 1 - Math.abs(l - POP_CLICK) / 3 : 0;
  const g = popGeom(p, pose);
  const k = 1 + (p.k - 1) * t - press * 0.05;
  return (
    <>
      <div style={{ position: "absolute", left: g.cx - g.w / 2, top: g.cy - g.h / 2, width: g.w, height: g.h, borderRadius: 14 * pose.s, background: "rgba(65,19,21,0.10)", opacity: clamp01(t * 1.4) }} />
      <div style={{ position: "absolute", left: g.cx - g.w / 2, top: g.cy - g.h / 2, width: g.w, height: g.h, borderRadius: 16 * pose.s, overflow: "hidden", background: "#FFFFFF",
        boxShadow: `0 ${(40 * t).toFixed(0)}px ${(70 * t).toFixed(0)}px rgba(65,19,21,${(0.28 * t).toFixed(2)}), 0 0 0 ${(2 * t).toFixed(1)}px rgba(255,90,0,${(0.35 * t).toFixed(2)})`,
        transform: `translate(${(p.dx * t).toFixed(1)}px, ${(p.dy * t).toFixed(1)}px) perspective(1400px) rotateX(${(8 * (1 - t) * (t > 0 ? 1 : 0)).toFixed(1)}deg) scale(${k.toFixed(3)})` }}>
        <Img src={staticFile(`pops/${p.still}.png`)} style={{ position: "absolute", left: -p.box.x * pose.s, top: -p.box.y * pose.s, width: SW * pose.s, height: SH * pose.s }} />
      </div>
    </>
  );
}

/* ================= the film ================= */
const LEFT_X = 170, RIGHT_X = 1100;
const PHONE_R = 1290, PHONE_L = 640;

function Film() {
  const f = useCurrentFrame();

  /* phone pose keyframes across the film */
  const pose: Pose = {
    cx: track(f, [[225, 960], [262, PHONE_R], [520, PHONE_R], [548, PHONE_L], [775, PHONE_L], [803, PHONE_R], [940, PHONE_R], [968, PHONE_L], [1108, PHONE_L], [1132, 960]]),
    cy: track(f, [[222, 1500], [258, 540], [1108, 540], [1132, 520]]),
    s: track(f, [[222, 0.86], [258, 0.93], [1108, 0.93], [1132, 0.5]]),
    ry: track(f, [[222, -24], [262, -10], [290, 0], [520, 0], [534, 22], [548, 0], [775, 0], [789, -22], [803, 0], [940, 0], [954, 22], [968, 0]]),
    rx: track(f, [[222, 38], [262, 0]]),
    rz: track(f, [[222, -10], [262, 0]]),
    o: (1 - ramp(f, 1120, 1134)) * ramp(f, 222, 232),
  };

  const shots: Shot[] = [{ src: "orders", at: 0 }];
  const clips: Clip[] = [
    { src: "orders", from: 262, len: 50 }, { src: "details", from: 312, len: 40 }, { src: "table", from: 352, len: 176 },
    { src: "method", from: 528, len: 132 }, { src: "receipt", from: 660, len: 116 }, { src: "share", from: 776, len: 164 },
    { src: "friend", from: 940, len: 195 },
  ];
  const pops: Pop[] = [
    { at: 280, still: "orders", box: { x: 18, y: 390, w: 394, h: 53 }, dx: -250, dy: 10, k: 1.55, hit: [300, 26] },
    { at: 440, still: "table", box: { x: 17, y: 656, w: 396, h: 81 }, dx: -250, dy: -40, k: 1.5, hit: [362, 40] },
    { at: 812, still: "share", box: { x: 17, y: 508, w: 396, h: 124 }, dx: -250, dy: -30, k: 1.45, hit: [335, 36] },
    { at: 980, still: "friend", box: { x: 17, y: 780, w: 396, h: 56 }, dx: 250, dy: -60, k: 1.5, hit: [198, 28] },
  ];
  const popTaps: Tap[] = pops.map((p) => ({ at: p.at + POP_CLICK, sx: 0, sy: 0, ...popClickPoint(p, pose) }));
  const taps: Tap[] = [
    popTaps[0], { at: 338, sx: 345, sy: 290 },
    { at: 390, sx: 51, sy: 584 }, { at: 422, sx: 125, sy: 584 }, popTaps[1], { at: 505, sx: 215, sy: 871 },
    { at: 580, sx: 215, sy: 140 }, { at: 624, sx: 84, sy: 140 },
    { at: 710, sx: 290, sy: 572 }, { at: 746, sx: 290, sy: 572 },
    popTaps[2],
    popTaps[3], { at: 1046, sx: 215, sy: 870 },
  ];
  // cursor visible only while the phone is still (not mid-swing)
  const cursorSpans: [number, number][] = [[276, 515], [560, 762], [808, 930], [976, 1062]];

  /* progress bar scene (1100–1190) */
  const pAt = 1265;
  const prog = ramp(f, pAt + 6, pAt + 54);
  const paid = 26.95 + (92.89 - 26.95) * prog;

  return (
    <AbsoluteFill style={{ background: BG, fontFamily: "Figtree", overflow: "hidden" }}>
      <style>{FONTS}</style>

      {/* 1 · hook */}
      <Sequence from={0} durationInFrames={92} name="hook">
        <Words words={[{ t: "Ordered", at: 4 }, { t: "for", at: 16 }, { t: "your", at: 22 }, { t: "friends?", at: 30, c: ACCENT }]} size={124} out={82} />
      </Sequence>
      <Sequence from={0} durationInFrames={92} name="hook-avatars" layout="none">
        <>{["omar", "sara", "ali"].map((n, i) => { const t = ramp(f, 40 + i * 6, 52 + i * 6, backOut); const o = 1 - ramp(f, 78, 88); return <Av key={n} n={n} size={96} x={850 + i * 110} y={700} o={clamp01(t) * o} sc={0.4 + 0.6 * t} />; })}</>
      </Sequence>

      {/* 2 · the problem */}
      <Sequence from={92} durationInFrames={78} name="problem">
        <Words words={words("Then comes the maths.", 0, 5, (i) => (i === 3 ? ACCENT : undefined))} size={104} y={480} out={64} />
        <Words words={words("And the chasing.", 24, 5, (i) => (i === 2 ? ACCENT : undefined))} size={104} y={620} out={64} />
      </Sequence>

      {/* 3 · the name */}
      <Sequence from={170} durationInFrames={70} name="name">
        <Words words={[{ t: "Introducing", at: 0, c: "#6B6B6B" }]} size={44} y={400} weight={700} out={46} />
        <NamePill at={6} out={46} />
      </Sequence>

      {/* side copy per scene */}
      <Sequence from={0} durationInFrames={1140} name="copy" layout="none">
        <>
          {f >= 262 && f < 352 ? <Side x={LEFT_X} a="Right from your order." b="Delivered? Tap Split the bill." at={268} out={342} accent={["order"]} /> : null}
          {f >= 352 && f < 440 ? <Side x={LEFT_X} a="Pick who ate." b="Tap your contacts. The table fills up." at={358} out={434} accent={["ate"]} /> : null}
          {f >= 440 && f < 528 ? <Side x={LEFT_X} a="Not on talabat? Add a guest." b="Each guest gets their own link." at={446} out={518} accent={["guest"]} /> : null}
          {f >= 548 && f < 660 ? <Side x={RIGHT_X} a="By item, equally or custom." b="Shares update as you tap." at={556} out={650} accent={["item,", "item"]} /> : null}
          {f >= 660 && f < 776 ? <Side x={RIGHT_X} a="Everyone gets their receipt." b="Fees and the pro discount, shared fairly." at={668} out={766} accent={["receipt"]} /> : null}
          {f >= 803 && f < 940 ? <Side x={LEFT_X} a="Guests join with a link." b="Their name appears the moment they log in." at={808} out={930} accent={["link"]} /> : null}
          {f >= 968 && f < 1135 ? <Side x={RIGHT_X} a="Pay now with talabat." b="It lands in Hamza’s talabat credit, not a bank account." at={1012} out={1124} accent={["talabat"]} /> : null}
        </>
      </Sequence>

      {/* the phone */}
      {f >= 220 && f < 1136 ? <Phone pose={pose} shots={shots} f={f} clips={clips} /> : null}
      {pops.map((p, i) => <PopOut key={i} p={p} pose={pose} f={f} />)}
      {f >= 220 && f < 1136 ? cursorSpans.map(([a, b], i) => <Cursor key={i} f={f} pose={pose} enter={a} exit={b} taps={taps.filter((t) => t.at > a && t.at < b)} />) : null}

      {/* 3b · why pay inside talabat */}
      <Sequence from={1137} durationInFrames={128} name="why-talabat">
        <Why />
      </Sequence>

      {/* 4 · paid back bar */}
      <Sequence from={pAt} durationInFrames={92} name="progress">
        <ProgressScene paid={paid} prog={prog} />
      </Sequence>

      {/* 5 · all settled */}
      <Sequence from={1355} durationInFrames={94} name="done">
        <Done />
      </Sequence>
      <Confetti at={1359} f={f} />

      {/* 6 · the fan of screens */}
      <Sequence from={1441} durationInFrames={98} name="fan">
        <Fan />
      </Sequence>

      {/* 7 · end card */}
      <Sequence from={1539} durationInFrames={96} name="end">
        <End />
      </Sequence>
    </AbsoluteFill>
  );
}

function NamePill({ at, out }: { at: number; out: number }) {
  const f = useCurrentFrame();
  const t = ramp(f, at, at + 16, backOut);
  const o = 1 - ramp(f, out, out + 10);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 470, display: "flex", justifyContent: "center", opacity: clamp01(ramp(f, at, at + 6)) * o }}>
      <div style={{ padding: "26px 64px", borderRadius: 999, background: ORANGE, color: "#FFFFFF", fontFamily: "Figtree", fontWeight: 900, fontSize: 112, letterSpacing: -2, lineHeight: 1, transform: `scale(${(0.6 + 0.4 * t).toFixed(3)})`, boxShadow: "0 30px 60px rgba(255,90,0,0.28)", filter: `blur(${(o < 1 ? (1 - o) * 12 : 0).toFixed(1)}px)` }}>Split the bill</div>
    </div>
  );
}


function Why() {
  const f = useCurrentFrame();
  const o = ramp(f, 0, 10) * (1 - ramp(f, 116, 128));
  const cards = [
    { t: "The money stays in talabat", d: "Paid back as credit, spent on the next order.", icon: "wallet" },
    { t: "Every friend gets the app", d: "To pay in talabat, they download it.", icon: "app" },
    { t: "More orders, more revenue", d: "Wallet credit brings people back.", icon: "bag" },
  ];
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <Words words={words("Why pay inside talabat?", 2, 5, (i) => (i >= 2 ? ACCENT : undefined))} size={92} y={230} />
      <div style={{ position: "absolute", left: 150, right: 150, top: 380, display: "flex", gap: 40 }}>
        {cards.map((c, i) => {
          const t = ramp(f, 24 + i * 16, 44 + i * 16, backOut);
          const a = clamp01(ramp(f, 24 + i * 16, 32 + i * 16));
          return (
            <div key={i} style={{ flex: 1, height: 420, borderRadius: 36, background: "#FFFFFF", boxShadow: "0 30px 60px rgba(65,19,21,0.10)", padding: 44, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 22, opacity: a, transform: `translateY(${((1 - t) * 80).toFixed(1)}px)` }}>
              <div style={{ width: 104, height: 104, borderRadius: 30, background: "#FFF1E8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {c.icon === "wallet" ? <svg width="64" height="54" viewBox="0 0 40 34"><path d="M6 8L26 2l4 6" fill={ORANGE} /><rect x="2" y="7" width="36" height="25" rx="5" fill={MAROON} /><rect x="24" y="14" width="14" height="11" rx="3.5" fill={ORANGE} /><circle cx="30" cy="19.5" r="2.2" fill="#FFF3EA" /></svg> : null}
                {c.icon === "app" ? <svg width="56" height="64" viewBox="0 0 28 32"><rect x="3" y="1" width="22" height="30" rx="5" fill={MAROON} /><rect x="6" y="5" width="16" height="20" rx="2" fill="#FFF3EA" /><path d="M14 8v10M10 14l4 4 4-4" stroke={ORANGE} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="14" cy="28" r="1.3" fill="#FFF3EA" /></svg> : null}
                {c.icon === "bag" ? <svg width="60" height="60" viewBox="0 0 40 40"><path d="M8 14h24l-2.2 22H10.2Z" fill={ORANGE} /><path d="M14 14v-3a6 6 0 0 1 12 0v3" fill="none" stroke={MAROON} strokeWidth="3.2" strokeLinecap="round" /><path d="M14 27l4-4 3 3 5-6" stroke="#FFF3EA" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
              </div>
              <div style={{ fontFamily: "Figtree", fontWeight: 900, fontSize: 46, lineHeight: 1.08, color: INK, letterSpacing: -1 }}>{c.t}</div>
              <div style={{ fontFamily: "Figtree", fontWeight: 500, fontSize: 30, lineHeight: 1.3, color: "#4A4A4A" }}>{c.d}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function ProgressScene({ paid, prog }: { paid: number; prog: number }) {
  const f = useCurrentFrame();
  const inA = ramp(f, 0, 12, easeOut), outA = ramp(f, 78, 90);
  return (
    <AbsoluteFill style={{ opacity: inA * (1 - outA) }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 330, display: "flex", justifyContent: "center", alignItems: "baseline", gap: 18, fontFamily: "Figtree" }}>
        <span style={{ fontSize: 132, fontWeight: 900, color: INK, letterSpacing: -3 }}>AED {paid.toFixed(2)}</span>
        <span style={{ fontSize: 64, fontWeight: 700, color: "#B8AEA2" }}>/ 92.89</span>
      </div>
      <div style={{ position: "absolute", left: 360, top: 540, width: 1200, height: 64, borderRadius: 32, background: "#EFE6DC", overflow: "hidden" }}>
        <div style={{ width: `${(4 + 96 * prog).toFixed(2)}%`, height: "100%", borderRadius: 32, background: `linear-gradient(90deg, #FFD9C2, ${ORANGE})` }} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 650, display: "flex", justifyContent: "center", gap: 36 }}>
        {[["omar", 0.02], ["sara", 0.3], ["ali", 0.62]].map(([n, p], i) => {
          const done = prog >= (p as number) + 0.3;
          const t = ramp(f, 12 + i * 5, 24 + i * 5, backOut);
          return (
            <div key={n as string} style={{ position: "relative", width: 110, height: 110, transform: `scale(${(0.5 + 0.5 * t).toFixed(3)})`, opacity: clamp01(t) }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: 55, overflow: "hidden", boxShadow: "0 0 0 5px #FFFFFF, 0 14px 30px rgba(65,19,21,0.16)" }}><Img src={staticFile(`av-${n}.svg`)} style={{ width: "100%", height: "100%" }} /></div>
              {done ? <svg width="40" height="40" viewBox="0 0 24 24" style={{ position: "absolute", right: -8, bottom: -8 }}><circle cx="12" cy="12" r="11" fill="#17803A" stroke="#FFFFFF" strokeWidth="2" /><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
            </div>
          );
        })}
      </div>
      <Words words={words("paid back", 4, 4)} size={44} y={860} weight={700} />
    </AbsoluteFill>
  );
}

function Done() {
  const f = useCurrentFrame();
  const t = ramp(f, 0, 16, backOut), o = 1 - ramp(f, 82, 94);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <Words words={[{ t: "All", at: 0 }, { t: "settled.", at: 6, c: ACCENT }]} size={120} y={360} />
      <div style={{ position: "absolute", left: 960 - 90, top: 520, width: 180, height: 180, borderRadius: 90, background: "#FFFFFF", boxShadow: "0 30px 70px rgba(23,128,58,0.22)", transform: `scale(${(0.3 + 0.7 * t).toFixed(3)})`, opacity: clamp01(ramp(f, 0, 6)), display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="110" height="110" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#17803A" /><path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="16" strokeDashoffset={(16 * (1 - ramp(f, 8, 22))).toFixed(2)} /></svg>
      </div>
    </AbsoluteFill>
  );
}

function Fan() {
  const f = useCurrentFrame();
  const list = ["orders", "table3", "method2", "receipt1", "share2", "friend3", "track2"];
  const o = ramp(f, 0, 10) * (1 - ramp(f, 86, 98));
  const drift = f * 1.6;
  return (
    <AbsoluteFill style={{ opacity: o }}>
      {list.map((src, i) => {
        const k = i - 3;
        const s = 0.5 - Math.abs(k) * 0.03;
        const pose: Pose = { cx: 960 + k * 300 - drift + 60, cy: 560 + Math.abs(k) * 28, s, ry: k * -14, rx: 6, rz: k * 3, o: 1 };
        const t = ramp(f, 4 + Math.abs(k) * 4, 22 + Math.abs(k) * 4, easeOut);
        return <Phone key={src} pose={{ ...pose, cy: pose.cy + (1 - t) * 500, o: t }} shots={[{ src, at: 0 }]} f={f} />;
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 300, background: `linear-gradient(180deg, ${BG} 30%, rgba(251,248,245,0))` }} />
      <Words words={words("One order. Everyone square.", 10, 5, (i) => (i >= 2 ? ACCENT : undefined))} size={84} y={200} />
    </AbsoluteFill>
  );
}

function End() {
  const f = useCurrentFrame();
  const t = ramp(f, 0, 18, backOut);
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, display: "flex", justifyContent: "center", opacity: clamp01(ramp(f, 0, 8)) }}>
        <div style={{ padding: "24px 60px", borderRadius: 999, background: ORANGE, color: "#FFFFFF", fontFamily: "Figtree", fontWeight: 900, fontSize: 100, letterSpacing: -2, lineHeight: 1, transform: `scale(${(0.7 + 0.3 * t).toFixed(3)})`, boxShadow: "0 30px 60px rgba(255,90,0,0.25)" }}>Split the bill</div>
      </div>
      <Words words={words("A feature concept for talabat", 14, 3)} size={48} y={610} weight={700} />
      <Words words={words("Designed by Hamza", 30, 3, (i) => (i === 2 ? ACCENT : "#6B6B6B"))} size={36} y={700} weight={700} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 790, display: "flex", justifyContent: "center", gap: 14 }}>
        {["you", "omar", "sara", "ali"].map((n, i) => {
          const a = ramp(f, 36 + i * 4, 48 + i * 4, backOut);
          return <div key={n} style={{ width: 72, height: 72, borderRadius: 36, overflow: "hidden", opacity: clamp01(a), transform: `scale(${(0.4 + 0.6 * a).toFixed(3)})`, boxShadow: "0 0 0 4px #FFFFFF, 0 10px 24px rgba(65,19,21,0.14)" }}><Img src={staticFile(`av-${n}.svg`)} style={{ width: "100%", height: "100%" }} /></div>;
        })}
      </div>
    </AbsoluteFill>
  );
}

registerRoot(() => <Composition id="split-the-bill-v3" component={Film} width={1920} height={1080} fps={30} durationInFrames={1635} />);
