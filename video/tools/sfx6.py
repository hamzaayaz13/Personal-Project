# Builds the cut-3 soundtrack: a marimba groove + sound effects on the film's action frames.
import numpy as np, scipy.io.wavfile as wf, scipy.signal as sg, glob, os, sys

SR = 48000
FPS = 30
DUR = (1745 + 90) / FPS
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

fr = lambda f: (f + 90) / FPS

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



# ---------- sound design only: soft, restrained ----------
def soft_whoosh(dur=0.6, g=1.0, seed=3):
    n = int(SR * dur); x = np.random.default_rng(seed).standard_normal(n).astype(np.float32)
    bb, aa = sg.butter(2, [250 / (SR / 2), 3200 / (SR / 2)], "band"); x = sg.lfilter(bb, aa, x)
    tt = np.linspace(0, 1, n); env = (np.sin(np.pi * tt) ** 3)
    x = x * env; return (x / (np.abs(x).max() + 1e-9) * g).astype(np.float32)
def air(dur=1.2):  # a quiet airy swell into the reveal
    n = int(SR * dur); x = np.random.default_rng(9).standard_normal(n).astype(np.float32)
    bb, aa = sg.butter(2, [1500 / (SR / 2), 8000 / (SR / 2)], "band"); x = sg.lfilter(bb, aa, x)
    tt = np.linspace(0, 1, n); x = x * tt ** 2.5 * (1 - np.clip((tt - 0.96) / 0.04, 0, 1))
    return (x / (np.abs(x).max() + 1e-9)).astype(np.float32)
def thump(f0=90, dur=0.35):  # a soft low hit, felt more than heard
    n = int(SR * dur); tt = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(f0 * (1 + 0.6 * np.exp(-tt * 30))) / SR
    return (np.sin(ph) * np.exp(-tt * 9)).astype(np.float32)
def tap():  # a quiet, rounded UI tap
    n = int(SR * 0.05); tt = np.arange(n) / SR
    x = np.sin(2 * np.pi * 1350 * tt) * np.exp(-tt * 140) + 0.5 * np.sin(2 * np.pi * 620 * tt) * np.exp(-tt * 90)
    return x.astype(np.float32)
def bub(up=True):  # a soft bubble pop for a message
    n = int(SR * 0.08); tt = np.arange(n) / SR
    f = np.linspace(520, 760, n) if up else np.linspace(640, 480, n)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 45)).astype(np.float32)
def key():
    n = int(SR * 0.02); tt = np.arange(n) / SR
    x = np.random.default_rng(int(tt.size)).standard_normal(n) * np.exp(-tt * 300)
    bb, aa = sg.butter(2, [2000 / (SR / 2), 7000 / (SR / 2)], "band")
    return sg.lfilter(bb, aa, x).astype(np.float32)
CLICK = tap(); WH = soft_whoosh(0.6); WH_S = soft_whoosh(0.4, seed=4); WH_L = soft_whoosh(0.9, seed=6)
def bell(n, g=1.0): return glock(n, 1.6) * g

# opening card
put(sfx, glock('C6', 1.6) * 0.2, 4 / FPS); put(sfx, glock('G5', 1.6) * 0.14, 10 / FPS)
# typing
for i in range(29): put(sfx, key(), fr(6 + i * 1.6), 0.18)
# messages float up: soft pops, quieter as they pile up
MSG = [(84,1),(100,1),(114,0),(124,0),(133,0),(141,1),(150,0),(156,0),(162,1),(167,0),(172,0),(176,1),(180,0),(184,1),(188,0),(192,1),(195,0),(198,1),(201,0),(204,1),(207,0),(210,1),(213,0),(216,1),(219,0),(222,1),(225,0),(228,1),(231,0),(234,1),(237,1),(240,0),(243,1)]
for k, (f, out) in enumerate(MSG): put(sfx, bub(bool(out)), fr(f), max(0.1, 0.22 - k * 0.003))
put(sfx, soft_whoosh(0.7, seed=8), fr(254), 0.25)
put(sfx, thump(70), fr(262), 0.55)                       # AED 57.34 never came back
put(sfx, WH_L, fr(296), 0.3)                              # into "chasing."
put(sfx, CLICK, fr(322), 0.35)                            # "Stop"
put(sfx, air(1.3), fr(344) - 1.3, 0.22)                   # a quiet swell into "Meet"
put(sfx, thump(110, 0.3), fr(344), 0.5)
put(sfx, bell("C6", 0.25), fr(362))                       # the name lands
SH = 168
for f in [300, 338, 390, 422, 462, 505, 580, 624, 710, 746, 834, 1002, 1046]: put(sfx, CLICK, fr(f + SH), 0.5)
for f in [280, 440, 812, 980]:                            # pop-outs: lift and settle
    put(sfx, WH_S, fr(f + SH) - 0.04, 0.18); put(sfx, thump(160, 0.12), fr(f + 30 + SH), 0.18)
for f in [250, 520, 775, 940, 1108]: put(sfx, WH if f != 250 else WH_L, fr(f + SH), 0.24)   # phone moves
put(sfx, WH_S, fr(778 + SH), 0.2)                         # the spin
put(sfx, bell("G5", 0.18), fr(918 + SH))                  # guest joins
put(sfx, bell("C6", 0.22), fr(1085 + SH))                 # paid
for i in range(3): put(sfx, WH_S, fr(1316 + 24 + i * 16), 0.12)   # cards rise
put(sfx, bell("C6", 0.22), fr(1446)); put(sfx, bell("G5", 0.16), fr(1452))   # all settled
put(sfx, WH_L, fr(1540), 0.26); put(sfx, WH, fr(1628), 0.2)                 # tunnel in / out
put(sfx, bell("C6", 0.2), fr(1649))

mix = sfx[: int(DUR * SR)]
mix /= np.abs(mix).max() + 1e-9
mix *= 0.8
wf.write(OUT, SR, (np.stack([mix, mix], 1) * 32767).astype(np.int16))
print("wrote", OUT)
