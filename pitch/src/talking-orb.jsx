import React from 'react';
import { createRoot } from 'react-dom/client';
import { VoiceRing } from 'voice-ring';

/* A believable "talking" level with no microphone: phrases of syllables with pauses. */
function makeTalker() {
  let t0 = performance.now(), phraseEnd = 0, pauseEnd = 0, syl = 0, sylT = 0, amp = 0, level = 0, last = t0;
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  let mode = 'talk', manual = null;
  const api = {
    get() {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (manual) return manual();
      if (mode === 'idle') { level += (0.02 - level) * dt * 4; return level; }
      const t = (now - t0) / 1000;
      if (t > phraseEnd && t > pauseEnd) { phraseEnd = t + 1.4 + rnd() * 2.4; pauseEnd = phraseEnd + 0.25 + rnd() * 0.6; }
      const speaking = t < phraseEnd;
      if (t > sylT) { sylT = t + 0.11 + rnd() * 0.16; syl = speaking ? 0.35 + rnd() * 0.65 : 0; }
      amp += ((speaking ? syl : 0) - amp) * Math.min(1, dt * 14);           // syllable attack/decay
      const target = amp * (0.75 + 0.25 * Math.sin(t * 31)) ;              // a little vocal flutter
      level += (target - level) * Math.min(1, dt * 18);
      return Math.max(0, Math.min(1, level));
    },
    set(m) { mode = m; }, drive(fn) { manual = fn; },
  };
  return api;
}

function Orb({ talker, size, state }) {
  return <VoiceRing size={size} state={state} level={() => talker.get()} theme="dark" sensitivity={0.7} />;
}
window.TalkingOrb = {
  mount(el, opts = {}) {
    const talker = makeTalker(); const root = createRoot(el);
    let state = opts.state || 'speaking', size = opts.size || 320;
    const draw = () => root.render(<Orb talker={talker} size={size} state={state} />);
    draw();
    return { talker, setState(s) { state = s; talker.set(s === 'speaking' ? 'talk' : 'idle'); draw(); }, setSize(n) { size = n; draw(); } };
  },
};
