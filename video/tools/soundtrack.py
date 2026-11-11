# Builds the cut-3 soundtrack: a marimba groove + sound effects on the film's action frames.
import numpy as np, scipy.io.wavfile as wf, scipy.signal as sg, glob, os, sys

SR = 48000
FPS = 30
DUR = 1635 / FPS
SND = sys.argv[1]
OUT = sys.argv[2]
N = int(DUR * SR) + SR

def load(name):
    p = glob.glob(os.path.join(SND, name))[0]
    sr, x = wf.read(p)
    x = x.astype(np.float32)
    if x.ndim > 1: x = x.mean(1)
    # trim leading silence
    idx = np.argmax(np.abs(x) > 0.01 * np.abs(x).max())
    x = x[idx:]
    return x / (np.abs(x).max() + 1e-9)

def pitch(x, semis):
    if semis == 0: return x
    r = 2 ** (semis / 12)
    n = int(len(x) / r)
    return np.interp(np.arange(n) * r, np.arange(len(x)), x).astype(np.float32)

def fade(x, ms=40):
    n = min(len(x), int(SR * ms / 1000))
    x = x.copy(); x[-n:] *= np.linspace(1, 0, n); return x

music = np.zeros(N, np.float32)
sfx = np.zeros(N, np.float32)
def put(buf, x, t, g=1.0):
    i = int(t * SR)
    if i >= N: return
    x = x[: N - i]
    buf[i:i + len(x)] += x * g

fr = lambda f: f / FPS

# ---------- instruments ----------
NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
def midi(n):  # "C4"
    return 12 * (int(n[-1]) + 1) + NOTE[n[0]] + (1 if "#" in n else 0)
MAR = {midi(n): load(f"vcsl-marimba__{n}.wav") for n in ["B2", "F3", "C4", "G4", "B4", "F5"]}
def marimba(n, dur=1.2):
    m = midi(n); src = min(MAR, key=lambda k: abs(k - m))
    x = pitch(MAR[src], m - src)[: int(SR * dur)]
    return fade(x, 120)
GLK = {midi(n): load(f"vcsl-glockenspiel__{n}.wav") for n in ["C5", "G5", "C6"]}
def glock(n, dur=2.0):
    m = midi(n); src = min(GLK, key=lambda k: abs(k - m))
    return fade(pitch(GLK[src], m - src)[: int(SR * dur)], 300)
KICK = fade(load("vcsl-bass-drum-1__BDrumNew_hit_v5_rr1_Sum.wav")[: int(SR * 0.6)], 150)
SHK = [fade(load(f"vcsl-shaker-small__Mid_ShakerHighFaster_{d}_rr1.wav")[: int(SR * 0.25)], 60) for d in ("Down", "Up")]
WOOD = fade(load("vcsl-woodblock__wood_click_pp_rr1.wav")[: int(SR * 0.2)], 40)
CHIME_UP = fade(load("vcsl-mark-trees__windchimes_fastAsc1.wav")[: int(SR * 2.2)], 600)
CHIME_RND = fade(load("vcsl-mark-trees__windchimes_random.wav")[: int(SR * 2.5)], 800)

# ---------- music: 104 bpm, C - Am - F - G ----------
BPM = 104; BEAT = 60 / BPM; E8 = BEAT / 2
prog = [["C4", "E4", "G4", "C5"], ["A3", "C4", "E4", "A4"], ["F3", "A3", "C4", "F4"], ["G3", "B3", "D4", "G4"]]
bass = ["C3", "A2", "F2", "G2"]
t = 0.25; bar = 0
start_drums = fr(222)      # the phone enters
music_end = fr(1600)
while t < music_end:
    ch = prog[bar % 4]
    pat = [0, 2, 1, 3, 2, 1, 3, 2]  # arpeggio over the bar (8 eighths)
    for k in range(8):
        tt = t + k * E8
        if tt >= music_end: break
        lvl = 0.30 if t < fr(170) else 0.36
        put(music, marimba(ch[pat[k]], 0.9), tt, lvl * (1.0 if k % 2 == 0 else 0.75))
    put(music, marimba(bass[bar % 4], 1.6), t, 0.26)
    if t >= start_drums - 0.01:
        for b in range(4):
            tb = t + b * BEAT
            if b in (0, 2): put(music, KICK, tb, 0.55)
            put(music, SHK[b % 2], tb + E8, 0.16)
    t += 4 * BEAT; bar += 1
# fade the bed out over the end card
fe = np.ones(N, np.float32); a, b = int(fr(1560) * SR), int(fr(1630) * SR)
fe[a:b] = np.linspace(1, 0, b - a); fe[b:] = 0; music *= fe
# duck the bed a little under the why-talabat cards so they read
duck = np.ones(N, np.float32)
for (s0, s1) in [(fr(1137), fr(1265))]:
    i0, i1 = int(s0 * SR), int(s1 * SR); r = int(0.3 * SR)
    duck[i0:i1] = 0.7; duck[i0 - r:i0] = np.linspace(1, 0.7, r); duck[i1:i1 + r] = np.linspace(0.7, 1, r)
music *= duck

# ---------- synthesized effects ----------
def whoosh(dur=0.45, up=True):
    n = int(SR * dur); x = np.random.default_rng(3).standard_normal(n).astype(np.float32)
    env = np.sin(np.linspace(0, np.pi, n)) ** 2
    f0, f1 = (300, 2400) if up else (2400, 300)
    out = np.zeros(n, np.float32); seg = 1024
    for i in range(0, n, seg):
        fc = f0 + (f1 - f0) * (i / n)
        bb, aa = sg.butter(2, [max(80, fc * 0.6) / (SR / 2), min(0.99, fc * 1.4 / (SR / 2))], "band")
        out[i:i + seg] = sg.lfilter(bb, aa, x[i:i + seg])
    return (out * env / (np.abs(out).max() + 1e-9)).astype(np.float32)
def blip(f0=520, f1=980, dur=0.12):
    n = int(SR * dur); tt = np.arange(n) / SR
    f = np.linspace(f0, f1, n); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-tt * 28)).astype(np.float32)
def tick():
    n = int(SR * 0.03); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * 2200 * tt) * np.exp(-tt * 260)).astype(np.float32)
WH_UP, WH_DN = whoosh(0.5, True), whoosh(0.4, False)
CLICK = WOOD * 0.8 + np.pad(tick(), (0, len(WOOD) - len(tick()))) * 0.35

# taps (frames) — cursor presses
taps = [300, 338, 390, 422, 462, 505, 580, 624, 710, 746, 834, 1002, 1046]
for f in taps: put(sfx, CLICK, fr(f), 0.9)
# pop-outs: lift + settle back
for f in [280, 440, 812, 980]:
    put(sfx, blip(480, 1100, 0.14), fr(f), 0.35); put(sfx, WH_UP[: int(SR * 0.3)], fr(f) - 0.05, 0.25)
    put(sfx, blip(900, 420, 0.1), fr(f + 30), 0.22)
# phone moves / swings
for f, g in [(222, 0.45), (520, 0.3), (775, 0.3), (940, 0.3), (1108, 0.35), (1441, 0.35)]:
    put(sfx, WH_UP if f in (222, 1441) else WH_DN, fr(f), g)
# seats landing on the table
for f, n in [(392, "E5"), (424, "G5"), (472, "C6")]: put(sfx, marimba(n, 0.7), fr(f), 0.45)
# receipt slides, method tabs: tiny shaker
for f in [712, 748, 582, 626]: put(sfx, SHK[1], fr(f), 0.25)
# name pill + end pill
put(sfx, glock("C6"), fr(176), 0.45); put(sfx, glock("G5"), fr(1543), 0.4); put(sfx, glock("C6"), fr(1549), 0.35)
# guest joins as Ali
put(sfx, CHIME_UP, fr(916), 0.35); put(sfx, glock("G5", 1.2), fr(918), 0.3)
# payment: processing tick, paid coin chime
put(sfx, glock("C6", 1.0), fr(1085), 0.45); put(sfx, glock("G5", 1.0), fr(1089), 0.35); put(sfx, SHK[0], fr(1085), 0.25)
# why cards
for i, n in enumerate(["C5", "E5", "G5"]): put(sfx, marimba(n, 0.6), fr(1137 + 24 + i * 16), 0.4)
# paid-back counter: rising plinks then a ding at the top
for i in range(8): put(sfx, marimba(["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"][i], 0.4), fr(1271 + i * 6), 0.22)
put(sfx, glock("C6"), fr(1319), 0.4)
# all settled + confetti
put(sfx, glock("C5", 1.5), fr(1355), 0.4); put(sfx, glock("G5", 1.5), fr(1359), 0.38); put(sfx, glock("C6", 2.0), fr(1363), 0.38)
put(sfx, CHIME_RND, fr(1359), 0.35)

mix = music * 0.4 + sfx * 1.15
mix = mix[: int(DUR * SR)]
mix /= np.abs(mix).max() + 1e-9
mix *= 0.85
wf.write(OUT, SR, (np.stack([mix, mix], 1) * 32767).astype(np.int16))
print("wrote", OUT, round(len(mix) / SR, 2), "s")
