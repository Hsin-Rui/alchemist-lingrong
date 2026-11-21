// 純遊戲引擎（functional core）。
// 不依賴 DOM / localStorage / Math.random：資料一律以參數 D（= GAME_DATA）傳入，
// 需要隨機的函式（後續加入）以注入的 rand 取用。
// 雙匯出：瀏覽器掛在 window.GameEngine，node 透過 module.exports。
(function () {
  'use strict';

  // ───────── 引擎內部小工具（暫與外殼各持一份，story 1.5 收斂）─────────
  // 隨機一律走注入的 rand，不碰 Math.random。
  const clamp = (n) => Math.max(0, Math.min(100, n));
  const charName = (D, who) => D.CHARS[who].name;

  function addFavor(S, who, n) {
    const before = S.favor[who];
    S.favor[who] = clamp(before + n);
    return S.favor[who] - before;
  }
  function addFriend(S, who, n) {
    const before = S.friend[who];
    S.friend[who] = clamp(before + n);
    return S.friend[who] - before;
  }
  function weightedPick(table, rand) {
    const total = table.reduce((s, [, w]) => s + w, 0);
    let r = rand() * total;
    for (const [id, w] of table) { if ((r -= w) < 0) return id; }
    return table[table.length - 1][0];
  }

  function newState(D) {
    const R = D.RULES;
    return {
      day: 1, slot: 0, silver: R.silver,
      favor: { ...R.favor },
      friend: { ...R.friend },
      conc: Object.fromEntries(D.TARGETS.map((t) => [t, { status: R.status[t], preg: 0, musk: 0, debuff: null }])),
      inv: { ...R.startInv },
      orders: [], hand: [], seq: 0,
      flip: null, bribe: 0, bribedToday: false, groundUntil: 0,
      noFlipNights: 0, empressBoost: false, tired: false,
      stats: { spikesUsed: 0, success: 0, caught: 0, groundedDays: 0, victims: [], ruined: [], sings: 0, bribes: 0, junk: 0, births: 0, muskRuin: 0 },
      log: [], dayLog: [], result: null,
    };
  }

  // 封號判定：吃整個 S（部分條件讀 S.friend，不只 S.stats）；D 供部分條件取 TARGETS。
  // 判定順序與 D.TITLES 無關；D.TITLES 的排序決定誰是主封號。
  const TITLE_CHECK = {
    shexiang: (S) => S.stats.muskRuin > 0,
    shuangmian: (S, D) => S.stats.victims.length === 3 && S.stats.caught === 0 && D.TARGETS.every((t) => S.friend[t] >= 35),
    duanzi: (S) => ['meizhuang', 'zhenhuan'].every((t) => S.stats.ruined.includes(t)),
    wentaiyi: (S) => S.stats.caught >= 2,
    guimi: (S, D) => D.TARGETS.every((t) => S.friend[t] >= 40),
    baimang: (S) => S.stats.spikesUsed > 0 && S.stats.success === 0,
    jingshi: (S) => S.stats.bribes >= 2,
    miaoyin: (S) => S.stats.sings >= 2,
    bailian: (S) => S.stats.spikesUsed === 0,
    heian: (S) => S.stats.junk >= 1,
    zhongsi: (S) => S.stats.births >= 1,
    touming: () => false,
  };

  // 純函式：before 是之前的封號冊（由外殼傳入）；不碰 localStorage、不存檔。
  function computeEnding(D, S, before) {
    before = before || [];
    const f = S.favor;
    const grounded = S.day <= S.groundUntil;
    const rank = 1 + D.TARGETS.filter((t) => f[t] >= f.lingrong).length;
    const top = rank === 1 ? 'lingrong' : D.TARGETS.reduce((a, b) => (f[b] > f[a] ? b : a));
    const opening = [D.END_TOP[top]];
    if (top !== 'lingrong') opening.push(D.END_LING[grounded ? 'grounded' : rank]);
    let titles = D.TITLES.filter((t) => TITLE_CHECK[t.id](S, D));
    if (!titles.length) titles = [D.TITLES.find((t) => t.id === 'touming')];
    const book = [...new Set([...before, ...titles.map((t) => t.id)])];
    return {
      rank, top, opening,
      main: titles[0], extra: titles.slice(1), book,
      fresh: titles.map((t) => t.id).filter((id) => !before.includes(id)),
    };
  }

  // ───────── 規則（被抓機率、翻牌子權重、枕邊風）─────────
  // via: 'deliver'（她自己點的東西，比較不會懷疑）或 'gift'
  function catchChance(D, S, who, spike, via) {
    const R = D.RULES;
    return D.ITEMS[spike].catch
      * Math.max(R.friendCatchFloor, 1 - S.friend[who] / R.friendCatchDivisor)
      * (via === 'deliver' ? R.deliverCatchFactor : 1);
  }
  const riskLevel = (p) => (p < 0.12 ? '低' : p < 0.25 ? '中' : '高');
  function pillowChance(D, S, who) {
    const R = D.RULES;
    return Math.max(0, Math.min(R.pillowMax, S.friend[who] - R.pillowBase)) / 100;
  }

  function flipWeights(D, S, bribe) {
    const R = D.RULES;
    if (bribe === undefined) bribe = S.bribe;
    const grounded = S.day <= S.groundUntil;
    const w = {};
    if (!grounded) w.lingrong = Math.max(1, S.favor.lingrong) * (S.empressBoost ? R.empressFactor : 1) + bribe;
    D.TARGETS.forEach((t) => { if (S.conc[t].status !== 'pregnant') w[t] = Math.max(1, S.favor[t]); });
    if (S.flip && w[S.flip]) w[S.flip] *= R.repeatFlipFactor; // 黃上喜新厭舊
    return w;
  }
  function flipOdds(D, S, bribe) {
    const w = flipWeights(D, S, bribe);
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    return Object.fromEntries(D.ALL.map((k) => [k, w[k] ? w[k] / total : 0]));
  }
  // 早上抽當晚侍寢者：用 S.bribe，隨機走注入的 rand。權重全空回傳 null。
  function chooseFlip(D, S, rand) {
    const entries = Object.entries(flipWeights(D, S, S.bribe));
    return entries.length ? weightedPick(entries, rand) : null;
  }

  // ───────── 加料 ─────────
  // 預測加料效果（純函式，不擲骰）
  function predict(D, S, who, spike, via) {
    const R = D.RULES;
    if (!spike) return { txt: '正經交貨', cls: 'neutral' };
    const c = S.conc[who];
    const it = D.ITEMS[spike];
    const risk = catchChance(D, S, who, spike, via);
    const out = { risk, riskTxt: `被抓風險：${riskLevel(risk)}` };
    if (spike === 'musk') {
      if (c.status === 'infertile') return { ...out, txt: '無效（已不孕）', cls: 'bad' };
      if (c.status === 'pregnant') return { ...out, txt: '50% 小產', cls: 'good' };
      return { ...out, txt: c.musk + 1 >= R.muskDoses ? `不孕 ${R.fx.infertile}` : `麝香 ${c.musk + 1}/${R.muskDoses}`, cls: 'good' };
    }
    if (spike === 'safflower') {
      if (c.status === 'infertile') return { ...out, txt: '無效（已不孕）', cls: 'bad' };
      if (c.status === 'pregnant') return { ...out, txt: `小產＋不孕 ${R.fx.saffMiscarry}`, cls: 'good' };
      return { ...out, txt: `不孕 ${R.fx.infertile}`, cls: 'good' };
    }
    const label = { itch: '狂癢', stinky: '口臭', croton: '腹瀉' }[spike];
    return { ...out, txt: `${label} ${R.fx[spike]}${S.flip === who ? '・今晚出包' : ''}`, cls: 'good', it };
  }

  // 真正下料（擲骰、改狀態、推 S.log/S.stats）。rand 注入。
  function applySpike(D, S, who, spike, via, rand) {
    const R = D.RULES;
    if (!spike) return { outcome: 'plain' };
    S.stats.spikesUsed++;
    const it = D.ITEMS[spike];
    if (rand() < catchChance(D, S, who, spike, via)) {
      const friendDelta = addFriend(S, who, R.caughtFriend);
      S.groundUntil = Math.max(S.groundUntil, S.day + it.ground);
      S.stats.caught++;
      S.stats.groundedDays += it.ground;
      S.log.push(`第 ${S.day} 天：對${charName(D, who)}下${it.name}，被太醫抓到，禁足 ${it.ground} 天`);
      return { outcome: 'caught', caught: true, friendDelta, days: it.ground };
    }
    const c = S.conc[who];
    let outcome;
    let fav = 0;
    let label = null;
    let ruin = false;
    if (spike === 'musk') {
      if (c.status === 'infertile') outcome = 'musk_useless';
      else {
        c.musk++;
        if (c.status === 'pregnant') {
          if (rand() < R.muskMiscarryChance) { outcome = 'miscarry_musk'; fav = R.fx.miscarry; label = '小產'; c.status = 'normal'; c.preg = 0; ruin = true; }
          else { outcome = 'musk_miss'; label = `麝香 ${c.musk}/${R.muskDoses}`; }
        } else if (c.musk >= R.muskDoses) { outcome = 'musk_infertile'; fav = R.fx.infertile; label = '不孕'; c.status = 'infertile'; ruin = true; }
        else { outcome = 'musk_dose'; label = `麝香 ${c.musk}/${R.muskDoses}`; }
      }
    } else if (spike === 'safflower') {
      if (c.status === 'infertile') outcome = 'safflower_useless';
      else if (c.status === 'pregnant') { outcome = 'miscarry_safflower'; fav = R.fx.saffMiscarry; label = '小產'; c.status = 'infertile'; c.preg = 0; ruin = true; }
      else { outcome = 'safflower_infertile'; fav = R.fx.infertile; label = '不孕'; c.status = 'infertile'; ruin = true; }
    } else {
      outcome = 'debuff';
      c.debuff = spike;
      fav = R.fx[spike];
      label = { itch: '狂癢', stinky: '口臭', croton: '腹瀉' }[spike];
    }
    const useless = outcome.endsWith('_useless');
    const favDelta = fav ? addFavor(S, who, fav) : 0;
    if (!useless) {
      S.stats.success++;
      if (!S.stats.victims.includes(who)) S.stats.victims.push(who);
    }
    if (ruin && !S.stats.ruined.includes(who)) S.stats.ruined.push(who);
    if (ruin && spike === 'musk') S.stats.muskRuin++;
    S.log.push(`第 ${S.day} 天：${charName(D, who)} ← ${it.name}（${useless ? '無效' : label}）`);
    return { outcome, useless, favDelta, label, dose: c.musk };
  }

  // ───────── 夜晚結算 ─────────
  // 引擎變更全部狀態（含 S.dayLog 字串）並回傳結構化報告；
  // 外殼依報告組對話 lines（見 renderNightLines），引擎不碰對話。
  // rand 擲骰語意順序：枕邊風 → 有喜（被抓／小產發生在白天的 applySpike）。
  function settleNight(D, S, { sing, rand }) {
    const R = D.RULES;
    const who = S.flip;
    const grounded = S.day <= S.groundUntil;
    const report = { who, grounded, sing, serve: null, pillow: null, conceived: null, births: [], empressQueued: false };
    let conceived = null;
    let servedLing = false;
    if (!who) {
      // 今晚不翻牌子，無侍寢
    } else if (who === 'lingrong') {
      if (grounded) {
        report.serve = { target: 'lingrong', favDelta: 0, kind: 'grounded' };
      } else {
        const d = addFavor(S, 'lingrong', R.serveFavor + (sing ? R.singExtraFavor : 0));
        S.dayLog.push(`零溶侍寢${sing ? '並演唱金縷衣' : ''}，恩寵 +${d}`);
        S.tired = sing;
        if (sing) S.stats.sings++;
        servedLing = true;
        report.serve = { target: 'lingrong', favDelta: d, kind: sing ? 'sing' : 'serve' };
      }
    } else {
      const c = S.conc[who];
      const name = charName(D, who);
      if (c.debuff) {
        const d = addFavor(S, who, R.serveFailFavor);
        S.dayLog.push(`${name}侍寢出包，恩寵 ${d}`);
        report.serve = { target: who, favDelta: d, kind: 'debuff', debuff: c.debuff };
      } else {
        const d = addFavor(S, who, R.serveFavor);
        S.dayLog.push(`${name}侍寢，恩寵 +${d}`);
        report.serve = { target: who, favDelta: d, kind: 'serve' };
        if (rand() < pillowChance(D, S, who)) {
          const g = addFavor(S, 'lingrong', R.pillowFavor);
          S.dayLog.push(`${name}吹了枕邊風，零溶恩寵 +${g}`);
          report.pillow = { favDelta: g };
        }
        if (c.status === 'normal' && rand() < R.pregnancyChance) {
          c.status = 'pregnant';
          c.preg = 0;
          conceived = who;
          report.conceived = who;
          S.dayLog.push(`${name}有喜了`);
        }
      }
    }
    // 懷孕進度（當晚受孕者該夜不 +preg）
    D.TARGETS.forEach((t) => {
      const c = S.conc[t];
      if (c.status !== 'pregnant' || t === conceived) return;
      c.preg++;
      if (c.preg >= R.pregnancyNights) {
        c.status = 'normal';
        c.preg = 0;
        const d = addFavor(S, t, R.birthFavor);
        S.stats.births++;
        report.births.push({ who: t, favDelta: d });
        S.dayLog.push(`${charName(D, t)}誕下皇嗣，恩寵 +${d}`);
      }
    });
    D.TARGETS.forEach((t) => { S.conc[t].debuff = null; });
    // 黃后進言倒數
    if (servedLing) S.noFlipNights = 0;
    else if (++S.noFlipNights >= R.empressNights) {
      S.noFlipNights = 0;
      S.empressBoost = true;
      report.empressQueued = true;
      S.dayLog.push('黃后似乎打算明天替零溶說話……');
    }
    return report;
  }

  const API = {
    newState, TITLE_CHECK, computeEnding,
    catchChance, riskLevel, pillowChance, flipWeights, flipOdds, chooseFlip,
    predict, applySpike, settleNight,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.GameEngine = API;
})();
