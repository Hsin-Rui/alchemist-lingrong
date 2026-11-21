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

  // 採集小遊戲場景生成的預設值（可調；即時層的半徑常數在外殼 js/game.js）。
  const GATHER_SECONDS = 30; // 每場倒數秒數
  const GUARD_SPEED = 0.16; // 侍衛巡邏速度（正規化座標／秒）
  const SCENE_MARGIN = 0.08; // 場景邊界留白（正規化）

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
  function invAdd(S, id, n = 1) {
    S.inv[id] = (S.inv[id] || 0) + n;
    if (S.inv[id] <= 0) delete S.inv[id];
  }
  const pick = (arr, rand) => arr[Math.floor(rand() * arr.length)];
  const itemName = (D, id) => (D.ITEMS[id] || D.PRODUCTS[id]).name;
  const have = (S, id) => S.inv[id] || 0;
  // 手上有好幾個同樣的成品時，用最新做好的那個
  const readyItem = (S, o) => S.hand.filter((h) => h.product === o.product).pop();
  const recipeOk = (D, S, pid) => D.PRODUCTS[pid].recipe.every((id) => have(S, id) >= 1);
  function findRecipe(D, a, b) {
    return Object.keys(D.PRODUCTS).find((pid) => {
      const r = D.PRODUCTS[pid].recipe;
      return r && ((r[0] === a && r[1] === b) || (r[0] === b && r[1] === a));
    });
  }
  const acceptChance = (D, S, who) => Math.min(100, S.friend[who] + D.RULES.giftAcceptBonus) / 100;

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

  // ───────── 流程與各行動 ─────────
  // 純狀態變更（擲骰走注入的 rand），回傳結構化結果/報告；外殼只負責 UI 回饋與路由。
  // 狀態變更（inv/hand/orders/silver/slot/seq/bribe*/favor/friend/stats/dayLog/result/tired/旗標）由此負責。

  // 買材料：足銀 → 扣錢、入庫；銀不足 → { ok:false }
  function buy(D, S, id) {
    const p = D.ITEMS[id].price;
    if (S.silver < p) return { ok: false };
    S.silver -= p;
    invAdd(S, id);
    return { ok: true };
  }

  // 賄賂敬事房：足銀且未打點 → 扣錢、加權、記錄；否則 { ok:false, reason }
  function bribe(D, S) {
    const R = D.RULES;
    if (S.bribedToday) return { ok: false, reason: 'done' };
    if (S.silver < R.bribeCost) return { ok: false, reason: 'poor' };
    S.silver -= R.bribeCost;
    S.bribe += R.bribeWeight;
    S.bribedToday = true;
    S.stats.bribes++;
    return { ok: true };
  }

  // 婉拒訂單：移訂單、友好 -、記 dayLog，回 { who }；找不到 → null
  function rejectOrder(D, S, id) {
    const R = D.RULES;
    const o = S.orders.find((x) => x.id === id);
    if (!o) return null;
    S.orders = S.orders.filter((x) => x !== o);
    addFriend(S, o.who, R.rejectFriend);
    S.dayLog.push(`婉拒了${charName(D, o.who)}的訂單，友好 ${R.rejectFriend}`);
    return { who: o.who };
  }

  // 採集：slot++，採 2+(rand<0.5?1:0) 個（各 weightedPick）進 inv，回 { loc, got, ready }
  function gather(D, S, loc, rand) {
    const g = D.GATHER[loc];
    S.slot++;
    const n = 2 + (rand() < 0.5 ? 1 : 0);
    const got = {};
    for (let i = 0; i < n; i++) {
      const id = weightedPick(g.table, rand);
      got[id] = (got[id] || 0) + 1;
      invAdd(S, id);
    }
    const ready = S.orders.filter((o) => !readyItem(S, o) && recipeOk(D, S, o.product));
    S.dayLog.push(`在${g.name}採集：${Object.entries(got).map(([id, c]) => `${itemName(D, id)}×${c}`).join('、')}`);
    return { loc, got, ready };
  }

  // 採集小遊戲・場景生成（純函式、隨機走注入 rand、不碰 DOM／計時器）。
  // 回 { loc, seconds, rare, items:[{id,rare,x,y}], guard:{x,y,waypoints,speed} }。
  // 保證該地圖每種素材至少各 1 個（含稀有），再從非稀有常見素材多撒幾個；座標皆正規化 0..1。
  // rand 擲骰順序：逐一素材座標 → 額外數量 → 逐一（weightedPick＋座標）→ 侍衛起點 → 巡邏點數量 → 逐一巡邏點。
  function buildGatherScene(D, S, loc, rand) {
    const g = D.GATHER[loc];
    const coord = () => SCENE_MARGIN + rand() * (1 - 2 * SCENE_MARGIN);
    // 稀有素材：地圖指定；未指定則取權重最低者
    const rare = g.rare || g.table.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
    const commons = g.table.filter(([id]) => id !== rare);
    const items = [];
    // 每種素材先放 1 個（保證每種≥1、含稀有正好 1 個）
    for (const [id] of g.table) items.push({ id, rare: id === rare, x: coord(), y: coord() });
    // 再從「非稀有」常見素材多撒幾個（稀有維持 1 個、總數約 7～9）
    const extra = 3 + Math.floor(rand() * 3); // 3～5
    for (let i = 0; i < extra; i++) {
      const id = weightedPick(commons, rand);
      items.push({ id, rare: false, x: coord(), y: coord() });
    }
    // 侍衛：起點＋數個巡邏點＋速度（起點落在上半，遠離玩家入場點）
    const guard = { x: coord(), y: SCENE_MARGIN + rand() * (0.5 - SCENE_MARGIN), speed: GUARD_SPEED, waypoints: [] };
    const wp = 3 + Math.floor(rand() * 2); // 3～4 個巡邏點
    for (let i = 0; i < wp; i++) guard.waypoints.push({ x: coord(), y: coord() });
    return { loc, seconds: GATHER_SECONDS, rare, items, guard };
  }

  // 採集小遊戲・收穫套用（純函式，無 rand）：把這趟撿到的 got 加進包包、slot++、推 dayLog、回 ready。
  // got 空（被抓／逾時卻兩手空空）→ inv 不變、仍 slot++、dayLog 記「空手而回」。
  function applyGatherHaul(D, S, loc, got) {
    const g = D.GATHER[loc];
    S.slot++;
    const entries = Object.entries(got || {}).filter(([, c]) => c > 0);
    for (const [id, c] of entries) invAdd(S, id, c);
    const ready = S.orders.filter((o) => !readyItem(S, o) && recipeOk(D, S, o.product));
    S.dayLog.push(entries.length
      ? `在${g.name}採集：${entries.map(([id, c]) => `${itemName(D, id)}×${c}`).join('、')}`
      : `在${g.name}空手而回`);
    return { loc, got: got || {}, ready };
  }

  // 調合（確定性，無 rand）：slot++、材料 -1、findRecipe→成品或 junk；成品入 hand/inv。
  function craft(D, S, craftSel) {
    const [a, b] = craftSel.mats;
    S.slot++;
    invAdd(S, a, -1); invAdd(S, b, -1);
    const product = findRecipe(D, a, b) || 'junk';
    if (product === 'junk') S.stats.junk++;
    const toInv = D.PRODUCTS[product].out === 'inv';
    const spike = toInv ? null : craftSel.spike;
    if (spike) invAdd(S, spike, -1);
    if (toInv) invAdd(S, product);
    const item = toInv ? null : { id: ++S.seq, product, spike: product === 'junk' ? null : spike };
    if (item) S.hand.push(item);
    // 從訂單進來的就送那張訂單；否則找第一張要這個成品的訂單
    const order = S.orders.find((o) => o.id === craftSel.forOrder && o.product === product) || S.orders.find((o) => o.product === product);
    S.dayLog.push(product === 'junk' ? '調合失敗，做出一坨黑黑的東西' : `調合了${itemName(D, product)}${spike ? `（加了${itemName(D, spike)}）` : ''}`);
    return { product, spike, toInv, lostSpike: product === 'junk' && spike, order, itemId: item && item.id };
  }

  // 交貨：移訂單＋手牌，applySpike，未被抓給 reward（無效×uselessRewardRate）＋deliverFriend，設 S.result。
  // itemId：指定要送哪一個成品（剛調合好的那個）；沒指定就送最新做好的。找不到成品 → { noItem:true }
  function deliver(D, S, orderId, itemId, rand) {
    const R = D.RULES;
    const order = S.orders.find((o) => o.id === orderId);
    const item = order && ((itemId && S.hand.find((h) => h.id === itemId && h.product === order.product)) || readyItem(S, order));
    if (!item) return { noItem: true };
    S.slot++;
    S.orders = S.orders.filter((o) => o !== order);
    S.hand = S.hand.filter((h) => h !== item);
    const who = order.who;
    const res = applySpike(D, S, who, item.spike, 'deliver', rand);
    let reward = 0;
    let friendDelta = res.friendDelta || 0;
    if (!res.caught) {
      const base = D.PRODUCTS[item.product].reward;
      reward = res.useless ? Math.round(base * R.uselessRewardRate) : base;
      if (!res.useless) friendDelta = addFriend(S, who, R.deliverFriend);
      S.silver += reward;
    }
    S.result = { kind: 'deliver', who, product: item.product, spike: item.spike, reward, friendDelta, ...res };
    S.dayLog.push(`交貨給${charName(D, who)}：${res.caught ? '被抓！' : `賞銀 +${reward}`}${res.label ? `，${res.label}` : ''}`);
    return S.result;
  }

  // 送禮：rand>=acceptChance → 拒收（S.result.refused）；否則 applySpike＋收禮友好，設 S.result。
  // junk／加料非侍寢者由外殼先擋；找不到成品 → { noItem:true }，被擋 → { blocked:true }
  function gift(D, S, who, handId, rand) {
    const item = S.hand.find((h) => h.id === handId);
    if (!item || item.product === 'junk') return { noItem: true };
    if (item.spike && who !== S.flip) return { blocked: true };
    S.slot++;
    if (rand() >= acceptChance(D, S, who)) {
      S.result = { kind: 'gift', who, product: item.product, spike: item.spike, refused: true, friendDelta: 0 };
      S.dayLog.push(`送禮給${charName(D, who)}被拒收`);
      return S.result;
    }
    S.hand = S.hand.filter((h) => h !== item);
    const res = applySpike(D, S, who, item.spike, 'gift', rand);
    let friendDelta = res.friendDelta || 0;
    if (!res.caught && !res.useless) friendDelta = addFriend(S, who, D.PRODUCTS[item.product].gift);
    S.result = { kind: 'gift', who, product: item.product, spike: item.spike, friendDelta, reward: 0, ...res };
    S.dayLog.push(`送${itemName(D, item.product)}給${charName(D, who)}${res.caught ? '，被抓！' : res.label ? `，${res.label}` : ''}`);
    return S.result;
  }

  // 開日：重置 dayLog；tired→slot=1；逾期訂單移除＋lateFriend；chooseFlip＋消耗 empressBoost＋重置 bribe；
  // 生成新訂單（weightedPick＋隨機抽對象）。回報告，外殼 renderStartLines 據此組對話。
  // rand 擲骰順序：chooseFlip → weightedPick(orderCountWeights) → 逐張訂單抽對象＋pick(NORMAL_ORDERS)。
  function startDay(D, S, rand) {
    const R = D.RULES;
    S.dayLog = [];
    const report = { tired: false, lapsed: [], grounded: false, boosted: false, flip: null, flipFriend: 0, newOrders: [], noOrders: false };
    if (S.tired) { S.tired = false; S.slot = 1; report.tired = true; }
    // 逾期
    S.orders = S.orders.filter((o) => {
      if (o.due >= S.day) return true;
      addFriend(S, o.who, R.lateFriend);
      report.lapsed.push({ who: o.who, product: o.product });
      S.dayLog.push(`${charName(D, o.who)}的訂單逾期，友好 ${R.lateFriend}`);
      return false;
    });
    const grounded = S.day <= S.groundUntil;
    report.grounded = grounded;
    // 翻牌子
    const boosted = S.empressBoost && !grounded;
    report.boosted = boosted;
    S.flip = chooseFlip(D, S, rand);
    if (boosted) S.empressBoost = false;
    S.bribe = 0;
    S.bribedToday = false;
    report.flip = S.flip;
    if (S.flip && D.TARGETS.includes(S.flip)) report.flipFriend = S.friend[S.flip];
    // 新訂單
    const n = weightedPick(R.orderCountWeights, rand);
    const cands = D.TARGETS.filter((t) => S.orders.filter((o) => o.who === t).length < R.maxOpenOrdersPerChar);
    for (let i = 0; i < n && cands.length; i++) {
      const who = cands.splice(Math.floor(rand() * cands.length), 1)[0];
      const product = S.conc[who].status === 'pregnant' ? 'tonic' : pick(D.NORMAL_ORDERS, rand);
      S.orders.push({ id: ++S.seq, who, product, due: S.day + R.orderDays - 1 });
      report.newOrders.push({ who, product });
    }
    report.noOrders = (n === 0);
    return report;
  }

  // 進日：day++、slot=0（外殼在 day>=days 時改走結局）
  function advanceDay(D, S) {
    S.day++;
    S.slot = 0;
  }

  const API = {
    newState, TITLE_CHECK, computeEnding,
    catchChance, riskLevel, pillowChance, flipWeights, flipOdds, chooseFlip,
    predict, applySpike, settleNight,
    findRecipe, acceptChance,
    buy, bribe, rejectOrder, gather, buildGatherScene, applyGatherHaul, craft, deliver, gift, startDay, advanceDay,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.GameEngine = API;
})();
