// 遊戲資料：素材、配方、數值、台詞。調數值或改台詞只要動這個檔案。
window.GAME_DATA = (() => {
  // 特性（game-design §13.1）：每種 1～3 級，成品最多 3 種
  const TRAITS = {
    xiang: { name: '香氣', color: '#B784F0' },
    tian: { name: '甜蜜', color: '#F08DB0' },
    hua: { name: '華麗', color: '#F4C66A' },
    qing: { name: '清雅', color: '#7FC8A9' },
    nong: { name: '濃郁', color: '#D9925A' },
  };

  // nature：採集時特性會偏向的「本性」（§8 素材表）
  const ITEMS = {
    // 正經素材（§8，第二輪）
    pine: { name: '松針', ch: '松', type: 'mat', price: 6, nature: ['qing'] },
    bamboo: { name: '竹葉', ch: '竹', type: 'mat', price: 6, nature: ['qing'] },
    lotus: { name: '藕粉', ch: '藕', type: 'mat', price: 6, nature: ['tian', 'qing'] },
    osmanthus: { name: '桂花', ch: '桂', type: 'mat', price: 8, nature: ['tian', 'xiang'] },
    pear: { name: '梨花', ch: '梨', type: 'mat', price: 8, nature: ['qing', 'xiang'] },
    jasmine: { name: '茉莉花', ch: '茉', type: 'mat', price: 8, nature: ['xiang', 'qing'] },
    plum: { name: '梅花', ch: '梅', type: 'mat', price: 10, nature: ['xiang', 'hua'] },
    jujube: { name: '紅棗', ch: '棗', type: 'mat', price: 5, nature: ['tian'] },
    motherwort: { name: '益母草', ch: '益', type: 'mat', price: 10, nature: ['qing', 'nong'] },
    angelica: { name: '當歸', ch: '歸', type: 'mat', price: 12, nature: ['nong'] },
    pearl: { name: '珍珠粉', ch: '珍', type: 'mat', price: 15, nature: ['hua'] },
    agarwood: { name: '沉香', ch: '沉', type: 'mat', price: 15, nature: ['nong', 'hua'] },
    // 害人用的素材（煉紅花）
    liquor: { name: '烈酒', ch: '酒', type: 'mat', price: 20 },
    petal: { name: '紅花瓣', ch: '瓣', type: 'mat' },
    // 料（§7）
    musk: { name: '麝香', ch: '麝', type: 'spike', price: 50, desc: '慢性毒。下滿 3 劑才不孕；有喜時 50% 小產', catch: 0.10, ground: 2 },
    safflower: { name: '紅花', ch: '紅', type: 'spike', desc: '猛藥。一次就不孕；有喜時小產並且不孕', catch: 0.40, ground: 4 },
    cassava: { name: '木薯粉', ch: '薯', type: 'spike', price: 15, desc: '上吐下瀉一天，侍寢必出包', catch: 0.15, ground: 1, debuff: '上吐下瀉' },
    catnip: { name: '貓薄荷', ch: '貓', type: 'spike', price: 20, desc: '晚上招來一群貓咪，侍寢必出包', catch: 0.15, ground: 1, debuff: '貓咪鬧場' },
  };

  // out: 'hand' 成品拿在手上（交貨、送禮）；'inv' 放回道具欄（例如煉出來的料）
  // recipe：2 或 3 樣素材，順序不拘。reward＝素材總值×1.5（安胎藥×2）；gift＝素材總值÷3（§8）
  const PRODUCTS = {
    yunv: { name: '神仙玉女粉', ch: '粉', recipe: ['pearl', 'motherwort'], reward: 38, gift: 8 },
    cake: { name: '藕粉桂花糖糕', ch: '糕', recipe: ['lotus', 'osmanthus'], reward: 21, gift: 5 },
    suihan: { name: '歲寒三友茶', ch: '茶', recipe: ['pine', 'bamboo', 'plum'], reward: 33, gift: 7 },
    incense: { name: '梨花帳中香', ch: '香', recipe: ['agarwood', 'pear'], reward: 35, gift: 8 },
    shuhen: { name: '舒痕膠', ch: '膠', recipe: ['pearl', 'jasmine'], reward: 35, gift: 8 },
    zuotai: { name: '坐胎藥', ch: '坐', recipe: ['angelica', 'motherwort'], reward: 33, gift: 7 },
    tonic: { name: '安胎藥', ch: '藥', recipe: ['angelica', 'jujube'], reward: 34, gift: 6 },
    safflower: { name: '紅花', ch: '紅', recipe: ['petal', 'liquor'], out: 'inv' },
    junk: { name: '一坨黑黑的東西', ch: '黑', recipe: null },
  };
  const NORMAL_ORDERS = ['yunv', 'cake', 'suihan', 'incense', 'shuhen'];

  const SHOP = ['pine', 'bamboo', 'lotus', 'osmanthus', 'pear', 'jasmine', 'plum', 'jujube', 'motherwort', 'angelica', 'pearl', 'agarwood', 'liquor', 'cassava', 'catnip', 'musk'];

  // 採集表：[素材, 權重]
  const GATHER = {
    garden: {
      name: '御花園', bg: 'garden', rare: 'catnip',
      bgm: 'gather', // 採集音樂：assets/audio/bgm_gather.lite.mp3（沒有就用 8-bit 合成曲）
      table: [['pine', 3], ['bamboo', 3], ['lotus', 3], ['osmanthus', 3], ['pear', 3], ['jasmine', 3], ['plum', 2], ['catnip', 1.5]],
      intro: '零溶提著小籃子，假裝在御花園賞花……',
      tired: '零溶乏了，決定回宮。', // 步數走完時的收尾對話框
      // 地形代號 → 像素圖（js/pixelart.js 的 id）。floor／hall 是變體清單；big 是佔 2×2 格的擺設（_0、_1 兩幀）
      tileset: {
        floor: ['grass_0', 'grass_1', 'grass_2'], hall: ['grass_0', 'grass_0', 'grass_1'], // 小徑也鋪草地，可走的地方一眼看得出來
        wallTop: 'hedge_top', wallFace: 'hedge_face', door: 'gate', big: 'pond',
        props: { F: 'flowerbed', R: 'rock', L: 'lantern' },
        names: { '#': '樹籬', P: '荷花池', F: '花圃', R: '假山', L: '石燈籠' }, // 撞到時的提示用
      },
      // 巡邏者，依登場順序：稱呼、像素 sprite、結算立繪（assets/characters，可省略）、登場提示、抓到零溶時說的話
      guards: [
        { name: '侍衛', sprite: 'guard', img: 'guard', note: '侍衛開始巡邏了', line: '小主，請回宮。' },
        { name: '侍衛', sprite: 'guard', img: 'guard', note: '侍衛增加了', line: '小主，請回宮。' },
      ],
      // 採集地下城參數（game-design §12.5）。引擎一律從這裡讀，不寫死。
      dungeon: {
        w: 25, h: 31, rooms: [5, 7], roomW: [4, 8], roomH: [3, 5], steps: 60,
        guardSight: 4.5, playerSight: 5.5,
        // 侍衛不是一開始就在場：走滿 step 步後登場，離零溶當下位置至少 minDist 格、盡量不超過 maxDist 格
        guardSpawns: [{ step: 10, minDist: 8, maxDist: 14 }, { step: 30, minDist: 5, maxDist: 11 }],
        rareCount: 2, extraItems: [5, 7], nearItem: 4, // 出生點 nearItem 格內保證有 1 個素材
        searchTurns: 3, wanderKeep: 0.7, wanderIdle: 0.1,
        loops: 2, rareReach: 0.7,
      },
    },
    taiyi: {
      name: '太醫院', bg: 'taiyi', rare: 'musk',
      bgm: 'gather', // 想讓太醫院用不同曲子：改成 'gather_taiyi'，放 bgm_gather_taiyi.lite.mp3
      table: [['jujube', 3], ['motherwort', 3], ['angelica', 3], ['pearl', 2], ['agarwood', 2], ['cassava', 2], ['liquor', 1.5], ['petal', 0.8], ['musk', 0.6]],
      intro: '趁太醫打瞌睡，零溶偷偷拉開了百子櫃……',
      tired: '零溶乏了，決定回宮。',
      tileset: {
        floor: ['ty_floor_0', 'ty_floor_1', 'ty_floor_2'], hall: ['ty_floor_0', 'ty_floor_0', 'ty_floor_1'], // 走廊也鋪木地板，可走的地方一眼看得出來
        wallTop: 'ty_wall_top', wallFace: 'ty_wall_face', door: 'ty_door', big: 'ty_stove',
        props: { F: 'ty_basket', R: 'ty_mortar', L: 'ty_candle' },
        names: { '#': '百子櫃', P: '煎藥爐', F: '藥材竹簍', R: '搗藥桌', L: '燭台' },
      },
      guards: [
        { name: '藥童', sprite: 'page', note: '藥童開始巡房了', line: '小主，這裡不能亂翻，請回宮。' },
        { name: '太醫溫十粗', sprite: 'doctor', img: 'doctor', note: '溫太醫睡醒了', line: '小主，請回宮歇著吧。' },
      ],
      // 室內：隔間多、每間小、走廊多。麝香太強，一趟只放 1 個（game-design §12.8）
      dungeon: {
        w: 25, h: 31, rooms: [6, 8], roomW: [3, 6], roomH: [3, 4], steps: 60,
        guardSight: 4.5, playerSight: 5.5,
        guardSpawns: [{ step: 10, minDist: 8, maxDist: 14 }, { step: 30, minDist: 5, maxDist: 11 }],
        rareCount: 1, extraItems: [4, 6], nearItem: 4,
        searchTurns: 3, wanderKeep: 0.7, wanderIdle: 0.1,
        loops: 3, rareReach: 0.7,
      },
    },
  };

  const CHARS = {
    lingrong: { name: '零溶', color: '#7b8fd1', face: '零', imgs: { smile: 'lingrong_smile', evil: 'lingrong_evil', shock: 'lingrong_shock' } },
    baojuan: { name: '包捐', color: '#5f9a7a', face: '捐', imgs: { _: 'baojuan' } },
    huafei: { name: '滑妃', color: '#d0453b', face: '滑', palace: '一捆宮', bg: 'yikun', maid: 'songzhi', imgs: { happy: 'huafei_happy', oops: 'huafei_oops' } },
    meizhuang: { name: '審沒裝', color: '#d99a2b', face: '審', palace: '嫌福宮', bg: 'xianfu', maid: 'caiyue', imgs: { happy: 'meizhuang_happy', oops: 'meizhuang_oops' } },
    zhenhuan: { name: '真環', color: '#e07f9c', face: '環', palace: '睡慾軒', bg: 'suiyu', maid: 'chuijinxi', imgs: { happy: 'zhenhuan_happy', oops: 'zhenhuan_oops' } },
    huangshang: { name: '黃上', color: '#d4a800', face: '黃', imgs: { _: 'huangshang', happy: 'huangshang_happy' } },
    huanghou: { name: '黃后', color: '#7a4e9a', face: '后', imgs: { _: 'huanghou' } },
    doctor: { name: '太醫溫十粗', color: '#4f7a8a', face: '溫', imgs: { _: 'doctor' } },
    // 各宮宮女：替主子下訂單（立繪沒有時用 face 字代替）
    songzhi: { name: '送吱', color: '#c0504a', face: '吱', imgs: { _: 'maid_songzhi' } },
    caiyue: { name: '踩月', color: '#d0a040', face: '月', imgs: { _: 'maid_caiyue' } },
    chuijinxi: { name: '吹緊吸', color: '#d98aa2', face: '吸', imgs: { _: 'maid_chuijinxi' } },
  };
  const TARGETS = ['huafei', 'meizhuang', 'zhenhuan'];
  // 三位妃嬪的喜好（§14.2，藏起來：畫面不暗示、不記錄）：喜歡／討厭的特性、喜歡／不喜歡的成品
  const PREFS = {
    huafei: { likeT: ['hua', 'nong'], hateT: ['qing'], likeP: ['yunv', 'incense', 'zuotai'], hateP: ['cake', 'tonic'] },
    meizhuang: { likeT: ['qing', 'tian'], hateT: ['hua'], likeP: ['cake', 'zuotai', 'tonic'], hateP: ['yunv'] },
    zhenhuan: { likeT: ['xiang', 'tian'], hateT: ['nong'], likeP: ['cake', 'suihan', 'yunv'], hateP: ['zuotai'] },
  };
  const ALL = ['lingrong', ...TARGETS];

  const RULES = {
    days: 10,
    slotsPerDay: 3,
    // 四階段調合（game-design §13.3–13.4）：攪拌次數、每次冒幾顆、大泡泡機率；
    // 起鍋橫條由左到右的分區寬度（%）與效果；珠珠來回一趟的毫秒數
    craft: {
      stirs: 3, bubbles: 3, bigChance: 0.2, bigValue: 2, natureWeight: 3,
      zones: [[14, 'down'], [29, 'keep'], [14, 'up'], [29, 'keep'], [14, 'down']],
      beadMs: 1600,
    },
    silver: 100,
    favor: { lingrong: 15, huafei: 60, meizhuang: 40, zhenhuan: 45 },
    friend: { huafei: 10, meizhuang: 40, zhenhuan: 50 },
    // 滑妃開局就不孕（歡你香梗）
    status: { huafei: 'infertile', meizhuang: 'normal', zhenhuan: 'normal' },
    startInv: { pine: 1, bamboo: 1, lotus: 1, osmanthus: 1, pear: 1, jasmine: 1, plum: 1, jujube: 1, motherwort: 1, angelica: 1, pearl: 1, agarwood: 1 },
    orderCountWeights: [[0, 25], [1, 45], [2, 30]],
    maxOpenOrdersPerChar: 2,
    orderDays: 3, // 期限：當天＋之後 2 天
    // 恩寵
    serveFavor: 10,
    serveFailFavor: -10,
    pillowFavor: 8,
    singExtraFavor: 5, // 侍寢時演唱金縷衣：恩寵額外 +5（共 +15），隔天早上要休息
    birthFavor: 20,
    pregnancyChance: 0.3,
    pregnancyNights: 4,
    // 枕邊風：機率 = 友好 − pillowBase（%），上限 pillowMax
    pillowBase: 20,
    pillowMax: 60,
    // 友好
    deliverFriend: 5,
    rejectFriend: -1,
    lateFriend: -5,
    caughtFriend: -30,
    giftAcceptBonus: 30, // 收禮機率 = 友好 + 30
    // 拜訪各宮（§14.1、§14.3）：伴手禮友好 =（成品 gift ＋喜歡特性每級 −討厭特性每級）× 係數；嫌棄時收禮機率再扣
    giftCoef: { like: 1.2, plain: 1, hate: 0.8 },
    hateAcceptPenalty: 20,
    visitEmptyFriend: 1,
    // 敬事房
    bribeCost: 150,
    bribeWeight: 100,
    // 黃上喜新厭舊：昨晚侍寢的人，今晚權重 × 0.5
    repeatFlipFactor: 0.5,
    // 零溶連續 N 晚沒被翻 → 黃后進言，下一次抽籤零溶權重 × 2
    empressNights: 3,
    empressFactor: 2,
    // 加料
    uselessRewardRate: 0.5,
    // 被抓機率 = 料的基礎機率 × max(下限, 1 − 友好 ÷ 除數) × (交貨時再 × deliverCatchFactor)
    friendCatchDivisor: 100,
    friendCatchFloor: 0.2,
    deliverCatchFactor: 0.5,
    muskDoses: 3,
    muskMiscarryChance: 0.5,
    fx: {
      infertile: -10, miscarry: -20, saffMiscarry: -25,
      cassava: -10, catnip: -8,
    },
  };

  // ───────── 台詞 ─────────
  // 每句台詞格式：[說話者, 表情, 內容]；說話者 'narr' 是旁白
  // 訂單需求（台詞總表 C1–C18），由宮女轉述：「我家娘娘{需求}」
  const NEEDS = {
    huafei: {
      yunv: '照鏡子照了一早上，說臉上多了一條細紋',
      cake: '嘴饞了，又不許御膳房的人知道',
      suihan: '今天罵人罵到口乾舌燥',
      incense: '一閉眼就看到真環那張臉，整夜睡不著',
      shuhen: '教訓宮女教訓到手背都擦破了皮',
      zuotai: '說今年一定要給黃上生個阿哥',
    },
    meizhuang: {
      yunv: '天乾物燥，臉上有些緊繃',
      cake: '想念家鄉的點心',
      suihan: '讀書讀到夜深，想喝杯清茶提神',
      incense: '最近心裡煩悶，夜裡總睡不安穩',
      shuhen: '練字時被硯台磕傷了手',
      tonic: '太醫說小主有喜了，想喝碗安胎藥補一補',
    },
    zhenhuan: {
      yunv: '想讓黃上多看兩眼',
      cake: '突然想吃點甜的',
      suihan: '倚梅園的梅花謝了，想喝點花茶解解悶',
      incense: '近來心事重重，總是睡不安穩',
      shuhen: '前幾日摔了一跤，手上留了道疤',
      tonic: '有了身孕，想喝碗安胎藥',
    },
  };

  // 宮女開口下單（台詞總表 B12–B14）
  function request(who, productId) {
    const p = PRODUCTS[productId].name;
    const need = NEEDS[who][productId];
    const maid = CHARS[who].maid;
    if (who === 'huafei') return [maid, '_', `安小主，我家娘娘${need}，要一份「${p}」。娘娘說了，東西只要最好的。`];
    if (who === 'meizhuang') return [maid, '_', `安小主安好。我家小主${need}，想請小主做一份「${p}」。`];
    return [maid, '_', `安小主安好。我家娘娘${need}，不知能否勞煩小主做一份「${p}」？`];
  }

  // 收下東西（交貨或送禮）時的反應
  const THANKS = {
    huafei: [['huafei', 'happy', '哼，還算妳有點用處。'], ['lingrong', 'smile', '（……好無聊。）']],
    meizhuang: [['meizhuang', 'happy', '妹妹的手藝真好，難怪大家都誇妳。'], ['lingrong', 'smile', '姐姐喜歡就好。']],
    zhenhuan: [['zhenhuan', 'happy', '妹妹真是貼心。'], ['lingrong', 'smile', '姐姐別客氣，妹妹只是想對姐姐好。']],
  };

  // 拜訪各宮：進門（E1–E3）、空手（E4–E6）
  const VISIT_ENTER = {
    huafei: [['huafei', 'happy', '喲，稀客。安妹妹今天怎麼有空來一捆宮？']],
    meizhuang: [['meizhuang', 'happy', '妹妹來了，快坐。踩月，上茶。']],
    zhenhuan: [['zhenhuan', 'happy', '妹妹來得正好，陪我說說話。']],
  };
  const VISIT_EMPTY = {
    huafei: [['huafei', 'happy', '空著手來？妳是來看本宮笑話的？']],
    meizhuang: [['meizhuang', 'happy', '妹妹能來就好，帶什麼東西。']],
    zhenhuan: [['zhenhuan', 'happy', '姐妹之間，不必拘禮。']],
  };

  const REFUSE = {
    huafei: [['huafei', 'happy', '本宮缺你這點東西？拿走拿走，別髒了本宮的地。'], ['lingrong', 'shock', '（……被轟出來了。）']],
    meizhuang: [['meizhuang', 'happy', '妹妹的心意我領了，東西就不必了。'], ['lingrong', 'shock', '（姐姐……還在跟我客氣嗎？）']],
    zhenhuan: [['zhenhuan', 'happy', '無功不受祿，妹妹收回去吧。'], ['lingrong', 'shock', '（她在防我？）']],
  };

  // 加料結果（共通版，{n} 會換成對方名字）
  const OUTCOME_LINES = {
    musk_dose: [
      ['{who}', 'happy', '這味道好香，用了整個人都放鬆了。'],
      ['lingrong', 'evil', '（麝香 {dose}/3……慢慢來，不急。）'],
    ],
    musk_infertile: [
      ['{who}', 'happy', '還是妹妹的東西最好用，我天天都用呢。'],
      ['narr', '', '日積月累的麝香終於見效——{n}從此再也沒有傳出喜訊。'],
      ['lingrong', 'evil', '（三劑，剛剛好。）'],
    ],
    musk_useless: [
      ['{who}', 'happy', '好香啊。可惜……我已經不能再有孩子了。'],
      ['lingrong', 'shock', '（已經不孕了……麝香白下了。）'],
    ],
    musk_miss: [
      ['{who}', 'happy', '這幾天胎動得厲害，好在太醫說無礙。'],
      ['lingrong', 'shock', '（嘖，這胎還挺穩的。）'],
    ],
    miscarry_musk: [
      ['{who}', 'happy', '妹妹有心了，聞著真安心。'],
      ['narr', '', '數日後，{palace}傳出噩耗：{n}小產了。太醫查了半天，只查出她最近很愛聞香。'],
      ['lingrong', 'evil', '（姐姐，對不起了。……不，其實也沒有很對不起。）'],
    ],
    miscarry_safflower: [
      ['{who}', 'happy', '這……怎麼有點紅紅的？'],
      ['lingrong', 'smile', '是紅棗熬的，姐姐趁熱。'],
      ['narr', '', '當夜，{palace}燈火通明。{n}的龍胎沒了，太醫說……以後也很難再有了。'],
      ['lingrong', 'evil', '（紅棗紅花，傻傻分不清楚。）'],
    ],
    safflower_infertile: [
      ['{who}', 'happy', '嗯？味道有點苦……'],
      ['narr', '', '從那天起，{n}的肚子再也沒有動靜。'],
      ['lingrong', 'evil', '（一碗就夠了。）'],
    ],
    safflower_useless: [
      ['{who}', 'happy', '妹妹……我已經生不了了，不必再費這個心。'],
      ['lingrong', 'shock', '（紅花白煉了！）'],
    ],
  };

  // 出糗類：每個人有自己的演出（白天收下時；台詞總表 F1–F10）
  const DEBUFF_LINES = {
    huafei: {
      cassava: [['huafei', 'oops', '本宮……本宮先失陪一下——！'], ['lingrong', 'evil', '（這就是囂張的下場。）']],
      catnip: [['huafei', 'happy', '這是什麼味道？……外頭的貓怎麼一直盯著本宮看？'], ['lingrong', 'evil', '（今晚，貓貓們會好好陪娘娘的。）']],
    },
    meizhuang: {
      cassava: [['meizhuang', 'oops', '失陪……失陪了……！'], ['lingrong', 'evil', '（呵呵。）']],
      catnip: [['meizhuang', 'happy', '好特別的味道……踩月，窗外是不是有貓在叫？'], ['lingrong', 'evil', '（不只一隻喔。）']],
    },
    zhenhuan: {
      cassava: [['zhenhuan', 'oops', '妹妹恕罪，我……我去去就回！'], ['lingrong', 'evil', '（姐姐，聰明有什麼用呢？）']],
      catnip: [['zhenhuan', 'happy', '這味道真特別。……奇怪，今天睡慾軒怎麼這麼多貓？'], ['lingrong', 'evil', '（姐姐，貓緣真好。）']],
    },
  };

  // 夜晚侍寢出包（F11、F13）
  const SERVE_FAIL = {
    cassava: '{n}侍寢到一半上吐下瀉，黃上連夜逃回癢心殿。',
    catnip: '半夜，十幾隻貓從窗戶湧進寢殿，全壓在黃上身上喵喵叫。{n}的侍寢泡湯了。',
  };

  // 侍寢出包時黃上的反應（用他「嚇到逃跑」的立繪；F12、F14）
  const SERVE_FAIL_HS = {
    cassava: '愛妃？愛妃妳怎麼又吐了——太醫！傳太醫！',
    catnip: '哪來這麼多貓？！喵……不對，朕是說——來人啊！',
  };

  const EMPRESS = [
    ['huanghou', '_', '皇上，安小主近日安分守己，又會唱曲，皇上也該去炎洗宮坐坐了。'],
    ['lingrong', 'shock', '（黃后娘娘……居然替我說話？她到底在打什麼算盤……）'],
  ];

  const SING = [
    ['lingrong', 'evil', '勸君莫惜金縷衣，勸君惜取少年時——'],
    ['huangshang', 'happy', '好！好一個金縷衣！朕今晚哪裡都不去了！'],
  ];

  const CAUGHT = [
    ['doctor', '_', '且慢！這東西裡……有{spike}！'],
    ['{who}', 'oops', '安妹妹！妳竟然——！'],
    ['lingrong', 'shock', '冤、冤枉啊！一定是有人陷害臣妾！'],
    ['narr', '', '黃上震怒：安小主禁足炎洗宮 {days} 天，好好反省！'],
  ];

  const TUTORIAL = [
    ['baojuan', '_', '小主！小主您醒啦！'],
    ['lingrong', 'smile', '包捐，我在這後宮……是不是最不受寵的那一個？'],
    ['baojuan', '_', '呃……小主恩寵確實是墊底的。但小主會煉金啊！'],
    ['baojuan', '_', '每天早上，敬事房會傳話今晚黃上翻誰的牌子。只有侍寢，恩寵才會漲。小主有銀子的話，也可以給敬事房包個大紅包……'],
    ['baojuan', '_', '各宮娘娘會來下訂單。替她們做東西，交情就會變好；交情好的娘娘侍寢時，可能會在黃上耳邊替小主美言幾句。'],
    ['lingrong', 'evil', '……交情不好的，就在她侍寢前送點「加了料」的禮。'],
    ['baojuan', '_', '小主英明！不過太醫溫十粗眼睛很利，被抓到可是要禁足的。跟娘娘交情越好，她越不會懷疑小主。'],
    ['baojuan', '_', '十天後，就看小主能不能在這後宮裡……逆襲了！'],
  ];

  // ───────── 結局 ─────────
  // 第一層：誰恩寵第一（寫在聖旨開頭）
  const END_TOP = {
    lingrong: '安小主零溶恩寵冠絕六宮，即日起改姓鈕祜祿！',
    huafei: '滑妃恩寵冠絕六宮，晉為皇貴妃，一捆宮夜夜笙歌。',
    meizhuang: '審沒裝恩寵冠絕六宮，晉為惠妃，嫌福宮從此不嫌福。',
    zhenhuan: '真環恩寵冠絕六宮，晉為熹妃，睡慾軒門庭若市。',
  };
  // 對手第一時，零溶的處境（禁足優先）
  const END_LING = {
    grounded: '安小主零溶尚在禁足，著閉門思過。',
    2: '安小主零溶屈居第二，只差一點點。',
    3: '安小主零溶位居第三，還得再加把勁。',
    4: '安小主零溶恩寵墊底，炎洗宮依舊門可羅雀。',
  };
  // 第二層：封號。依序排列＝越前面越稀有，拿到多個時，第一個是主封號，其餘「另外加封」。
  // 判定條件寫在 game.js 的 TITLE_CHECK。
  const TITLES = [
    { id: 'shexiang', name: '麝香代言人', seal: '麝香|代言人', comment: '一劑一劑，耐心是美德。歡宜香的配方，從此由炎洗宮獨家監製。', hint: '據說有一種香，聞久了就……' },
    { id: 'shuangmian', name: '雙面零溶', seal: '雙面|零溶', comment: '姐姐們都說安妹妹最貼心了。三位都中了招，卻沒有一個人懷疑妳。', hint: '表面姐妹情深，背地裡……而且一次都不能失手。' },
    { id: 'duanzi', name: '斷子絕孫專賣店', seal: '斷子絕孫|專賣店', comment: '炎洗宮出品，必屬佳品。後宮出生率創下歷史新低。', hint: '審沒裝和真環，好像都還生得出來……' },
    { id: 'wentaiyi', name: '溫太醫不要', seal: '溫太醫|不要', comment: '溫十粗太醫在炎洗宮門口擺了張桌子。妳一出門，他就搖頭。', hint: '被太醫抓到不只一次的話……' },
    { id: 'guimi', name: '後宮好閨蜜', seal: '後宮|好閨蜜', comment: '大家都好喜歡安妹妹！……雖然黃上還是不太記得妳。', hint: '三位姐姐都跟妳很要好的話……' },
    { id: 'baimang', name: '白忙一場', seal: '白忙|一場', comment: '料加了，錢花了，人一個都沒害到。', hint: '加了料，卻一次都沒得逞……' },
    { id: 'jingshi', name: '敬事房大金主', seal: '敬事房|大金主', comment: '敬事房的公公們逢年過節都送點心來，感謝妳養活了整個部門。', hint: '常給敬事房包紅包的話……' },
    { id: 'bailian', name: '白蓮花', seal: '白蓮花', comment: '十天來安分守己，什麼都沒加。……妳是來玩什麼遊戲的？', hint: '從頭到尾都乖乖的話……' },
    { id: 'heian', name: '零溶a黑暗料理', seal: '零溶a|黑暗料理', comment: '炎洗宮的鍋子冒出了不可名狀的黑煙，御膳房派人來請教配方。', hint: '配方記錯，也不全是壞事……' },
    { id: 'zhongsi', name: '螽斯門零溶', seal: '螽斯門|零溶', comment: '後宮添了新皇嗣，螽斯門前張燈結綵。零溶站在門口，笑得比誰都燦爛。', hint: '後宮要是有喜事……' },
    { id: 'miaoyin', name: '真・妙音娘子', seal: '真・妙音|娘子', comment: '一曲金縷衣，餘音繞樑十日不絕。黃上現在一閉上眼睛就會聽到。', hint: '據說多唱幾次歌會有好事……' },
    { id: 'touming', name: '炎洗宮小透明', seal: '炎洗宮|小透明', comment: '黃上到現在還是記不住妳叫什麼名字。', hint: '什麼特別的事都沒發生的話……' },
  ];

  // 主畫面零溶的閒聊台詞
  const IDLE = [
    '今天要對誰下手呢……',
    '我只是個平凡的煉金術士而已。',
    '姐姐們都對我好好喔……（呵）',
    '包捐，去把鍋子刷一刷。',
    '黃上什麼時候才會翻我的牌子呢？',
  ];

  return {
    TRAITS, ITEMS, PRODUCTS, NORMAL_ORDERS, SHOP, GATHER, CHARS, TARGETS, PREFS, ALL, RULES,
    request, THANKS, REFUSE, VISIT_ENTER, VISIT_EMPTY, EMPRESS, SING, OUTCOME_LINES, DEBUFF_LINES, SERVE_FAIL, SERVE_FAIL_HS, CAUGHT, TUTORIAL, END_TOP, END_LING, TITLES, IDLE,
  };
})();
