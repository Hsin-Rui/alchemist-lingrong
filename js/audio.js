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

  // 8-bit 短音（方波為主，給採集地下城用）
  function blip(freq, when, dur = 0.08, vol = 0.12, type = 'square') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(vol, when);
    g.gain.setValueAtTime(vol, when + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(master);
    o.start(when);
    o.stop(when + dur + 0.02);
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
    // 採集地下城
    step() { blip(170, ctx.currentTime, 0.035, 0.05, 'triangle'); },
    bump() { blip(98, ctx.currentTime, 0.09, 0.1); },
    pick() { const t = ctx.currentTime; blip(988, t, 0.06, 0.1); blip(1319, t + 0.06, 0.1, 0.1); },
    pickRare() { const t = ctx.currentTime; [784, 988, 1175, 1568, 1976].forEach((f, i) => blip(f, t + i * 0.07, 0.12, 0.11)); },
    alert() { const t = ctx.currentTime; blip(1568, t, 0.07, 0.14); blip(1568, t + 0.1, 0.2, 0.14); },
    lost() { const t = ctx.currentTime; blip(659, t, 0.09, 0.09); blip(523, t + 0.13, 0.18, 0.09); },
    caught() { const t = ctx.currentTime; [784, 622, 494, 370, 262].forEach((f, i) => blip(f, t + i * 0.09, 0.14, 0.14, 'sawtooth')); noise(t, 0.2, 0.3, 500); },
    timeout() { const t = ctx.currentTime; [98, 147, 196].forEach((f) => pluck(f, t, 2, 0.25, 'sine')); blip(392, t, 0.3, 0.06); },
    enterDungeon() { const t = ctx.currentTime; [262, 330, 392, 523, 659].forEach((f, i) => blip(f, t + i * 0.06, 0.09, 0.1)); },
    exitDungeon() { const t = ctx.currentTime; [659, 523, 392, 330, 262].forEach((f, i) => blip(f, t + i * 0.06, 0.09, 0.1)); },
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

  // ───── 採集地下城的 8-bit 潛行循環曲（方波旋律＋三角波低音＋輕拍點）─────
  const CHIP = { A2: 110, C3: 131, D3: 147, E3: 165, G3: 196, A3: 220, C4: 262, D4: 294, E4: 330, G4: 392, A4: 440, C5: 523 };
  const CHIP_MELODY = [
    'A3', null, 'C4', null, 'D4', null, 'E4', null, 'G4', null, 'E4', null, 'D4', 'C4', null, null,
    'A3', null, 'C4', null, 'D4', null, 'E4', 'G4', 'A4', null, 'G4', null, 'E4', null, null, null,
    'C4', null, 'D4', null, 'E4', null, 'G4', null, 'A4', null, 'C5', null, 'A4', 'G4', null, null,
    'E4', null, 'D4', null, 'C4', null, 'D4', 'E4', 'A3', null, null, null, 'G3', null, 'A3', null,
  ];
  const CHIP_BASS = ['A2', 'A2', 'C3', 'C3', 'D3', 'D3', 'E3', 'E3', 'A2', 'A2', 'C3', 'C3', 'E3', 'E3', 'A2', 'A2'];
  const CHIP_STEP = 0.16;
  let chipTimer = null;
  let inDungeon = false;
  let wasSynth = false;

  function startChip() {
    if (chipTimer || muted || !ensureCtx()) return;
    let step = 0;
    let next = ctx.currentTime + 0.1;
    chipTimer = setInterval(() => {
      while (next < ctx.currentTime + 0.4) {
        const n = CHIP_MELODY[step % CHIP_MELODY.length];
        if (n) blip(CHIP[n], next, 0.11, 0.045);
        if (step % 4 === 0) blip(CHIP[CHIP_BASS[Math.floor(step / 4) % CHIP_BASS.length]], next, 0.3, 0.09, 'triangle');
        if (step % 4 === 2) noise(next, 0.03, 0.05, 3000);
        next += CHIP_STEP;
        step++;
      }
    }, 100);
  }

  function stopChip() {
    clearInterval(chipTimer);
    chipTimer = null;
  }

  // 進地下城：主 BGM 暫停、換 8-bit 曲；出來再換回去
  function dungeonBgm(on) {
    if (on === inDungeon) return;
    inDungeon = on;
    if (on) {
      wasSynth = !!synthTimer;
      stopSynth();
      if (bgmEl) bgmEl.pause();
      startChip();
    } else {
      stopChip();
      if (muted) return;
      if (bgmEl) { const p = bgmEl.play(); if (p && p.catch) p.catch(() => {}); } else if (wasSynth) startSynth();
    }
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
    // 檔案載不到就改用合成旋律；人在地下城裡的話先記著，出來再播
    const fallback = () => { bgmEl = null; if (inDungeon) wasSynth = true; else startSynth(); };
    el.addEventListener('error', () => { if (bgmEl === el) fallback(); });
    const p = el.play();
    if (p && p.catch) p.catch(() => { if (bgmEl === el && el.error) fallback(); });
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('lingrong-muted', m ? '1' : '0'); } catch { /* 忽略 */ }
    if (master) master.gain.value = m ? 0 : 0.6;
    if (m) {
      stopSynth();
      stopChip();
      if (bgmEl) bgmEl.pause();
    } else if (inDungeon) {
      startChip();
    } else {
      const name = bgmName;
      bgmName = null;
      if (name) playBgm(name);
    }
  }

  return {
    sfx,
    playBgm,
    dungeonBgm,
    unlock() { ensureCtx(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    isMuted: () => muted,
    toggleMute() { setMuted(!muted); return muted; },
  };
})();
