// 聲音：音效全部用 Web Audio 即時合成；背景音樂優先用 assets/audio/ 的檔案，沒有就用合成旋律暫代。
window.GameAudio = (() => {
  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem('lingrong-muted') === '1'; } catch { /* 無痕模式等 */ }

  let bgmEl = null; // <audio> 背景音樂
  let bgmName = null;
  let synthTimer = null;

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
    return ctx;
  }

  // 撥弦音（像古箏）
  function pluck(freq, when, dur = 0.6, vol = 0.25, type = 'triangle') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(master);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  function sweep(from, to, when, dur, vol = 0.2, type = 'sine') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, when);
    o.frequency.exponentialRampToValueAtTime(to, when + dur);
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(master);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  function noise(when, dur, vol = 0.3, filterFreq = 800) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(master);
    src.start(when);
  }

  const SFX = {
    click() { pluck(880, ctx.currentTime, 0.08, 0.12, 'square'); },
    coin() { const t = ctx.currentTime; pluck(1318, t, 0.15, 0.15, 'square'); pluck(1760, t + 0.07, 0.3, 0.15, 'square'); },
    bubble() {
      const t = ctx.currentTime;
      for (let i = 0; i < 8; i++) sweep(200 + Math.random() * 300, 600 + Math.random() * 500, t + i * 0.13, 0.1, 0.12);
    },
    ding() { const t = ctx.currentTime; [784, 988, 1175, 1568].forEach((f, i) => pluck(f, t + i * 0.08, 0.5, 0.2)); },
    boom() { const t = ctx.currentTime; noise(t, 0.6, 0.5, 400); sweep(150, 40, t, 0.5, 0.4, 'sawtooth'); },
    evil() { const t = ctx.currentTime; [523, 494, 466, 440, 415].forEach((f, i) => pluck(f, t + i * 0.12, 0.3, 0.18, 'sawtooth')); },
    stamp() { const t = ctx.currentTime; noise(t, 0.25, 0.7, 300); sweep(120, 50, t, 0.25, 0.5); },
    fail() { const t = ctx.currentTime; pluck(392, t, 0.25, 0.2, 'square'); pluck(311, t + 0.2, 0.5, 0.2, 'square'); },
    pop() { sweep(400, 1200, ctx.currentTime, 0.12, 0.15); },
    gather() { const t = ctx.currentTime; [659, 784, 880].forEach((f, i) => pluck(f, t + i * 0.1, 0.4, 0.15)); },
    gong() { const t = ctx.currentTime; [98, 147, 196].forEach((f) => pluck(f, t, 2.5, 0.25, 'sine')); },
  };

  function sfx(name) {
    if (muted || !ensureCtx() || !SFX[name]) return;
    if (ctx.state === 'suspended') ctx.resume();
    SFX[name]();
  }

  // ───── 合成背景音樂：五聲音階小曲（宮商角徵羽） ─────
  const SCALE = { C4: 262, D4: 294, E4: 330, G4: 392, A4: 440, C5: 523, D5: 587, E5: 659, G5: 784, A5: 880, A3: 220, G3: 196, C3: 131, G2: 98, A2: 110, E3: 165 };
  const MELODY = [
    'E5', null, 'D5', 'C5', 'A4', null, 'C5', null, 'D5', 'E5', 'G5', null, 'E5', null, null, null,
    'A5', null, 'G5', 'E5', 'D5', null, 'E5', null, 'C5', 'D5', 'A4', null, 'G4', null, null, null,
    'C5', null, 'A4', 'G4', 'E4', null, 'G4', 'A4', 'C5', null, 'D5', 'E5', 'D5', null, 'C5', null,
    'A4', 'C5', 'D5', null, 'E5', 'D5', 'C5', 'A4', 'G4', null, 'A4', null, null, null, null, null,
  ];
  const BASS = ['A2', 'A2', 'G2', 'G2', 'C3', 'C3', 'A2', 'E3'];
  const STEP = 0.19; // 秒

  function startSynth() {
    if (synthTimer || !ensureCtx()) return;
    let step = 0;
    let next = ctx.currentTime + 0.1;
    synthTimer = setInterval(() => {
      while (next < ctx.currentTime + 0.4) {
        const n = MELODY[step % MELODY.length];
        if (n) pluck(SCALE[n], next, 0.9, 0.09);
        if (step % 8 === 0) pluck(SCALE[BASS[Math.floor(step / 8) % BASS.length]], next, 1.6, 0.08, 'sine');
        next += STEP;
        step++;
      }
    }, 100);
  }

  function stopSynth() {
    clearInterval(synthTimer);
    synthTimer = null;
  }

  function playBgm(name) {
    if (bgmName === name) return;
    bgmName = name;
    stopSynth();
    if (bgmEl) { bgmEl.pause(); bgmEl = null; }
    if (muted) return;
    const el = new Audio(`assets/audio/bgm_${name}.lite.mp3`);
    el.loop = true;
    el.volume = 0.6;
    bgmEl = el;
    el.addEventListener('error', () => { if (bgmEl === el) { bgmEl = null; startSynth(); } });
    const p = el.play();
    if (p && p.catch) p.catch(() => { if (bgmEl === el && el.error) { bgmEl = null; startSynth(); } });
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('lingrong-muted', m ? '1' : '0'); } catch { /* 忽略 */ }
    if (master) master.gain.value = m ? 0 : 0.6;
    if (m) {
      stopSynth();
      if (bgmEl) bgmEl.pause();
    } else {
      const name = bgmName;
      bgmName = null;
      if (name) playBgm(name);
    }
  }

  return {
    sfx,
    playBgm,
    unlock() { ensureCtx(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    isMuted: () => muted,
    toggleMute() { setMuted(!muted); return muted; },
  };
})();
