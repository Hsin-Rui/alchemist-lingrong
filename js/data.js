// 遊戲資料：素材、配方、數值、台詞。調數值或改台詞只要動這個檔案。
window.GAME_DATA = (() => {
  const ITEMS = {
    // 正經素材
    sandalwood: { name: '檀香', ch: '檀', type: 'mat', price: 10 },
    ricefl: { name: '糯米粉', ch: '糯', type: 'mat', price: 5 },
    honey: { name: '蜂蜜', ch: '蜜', type: 'mat', price: 8 },
    pearl: { name: '珍珠粉', ch: '珍', type: 'mat', price: 15 },
    jujube: { name: '紅棗', ch: '棗', type: 'mat', price: 5 },
    liquor: { name: '烈酒', ch: '酒', type: 'mat', price: 20 },
    jasmine: { name: '茉莉花', ch: '茉', type: 'mat' },
    osmanthus: { name: '桂花', ch: '桂', type: 'mat' },
    rose: { name: '玫瑰', ch: '玫', type: 'mat' },
    angelica: { name: '當歸', ch: '歸', type: 'mat' },
    petal: { name: '紅花瓣', ch: '瓣', type: 'mat' },
    // 料
    musk: { name: '麝香', ch: '麝', type: 'spike', price: 50, desc: '慢性毒。下滿 3 劑才不孕；有喜時 50% 小產', catch: 0.10, ground: 2 },
    safflower: { name: '紅花', ch: '紅', type: 'spike', desc: '猛藥。一次就不孕；有喜時小產並且不孕', catch: 0.40, ground: 4 },
    itch: { name: '癢癢粉', ch: '癢', type: 'spike', desc: '狂癢一天，侍寢必出包', catch: 0.15, ground: 1 },
    stinky: { name: '臭豆腐精華', ch: '臭', type: 'spike', price: 15, desc: '口臭一天，侍寢必出包', catch: 0.15, ground: 1 },
    croton: { name: '巴豆', ch: '巴', type: 'spike', desc: '腹瀉一天，侍寢必出包', catch: 0.15, ground: 1 },
  };

  // out: 'hand' 成品拿在手上（交貨、送禮）；'inv' 放回道具欄（例如煉出來的料）
  const PRODUCTS = {
    incense: { name: '安神香', ch: '香', recipe: ['sandalwood', 'jasmine'], reward: 28, gift: 5 },
    cake: { name: '桂花糕', ch: '糕', recipe: ['ricefl', 'osmanthus'], reward: 21, gift: 4 },
    cream: { name: '養顏膏', ch: '膏', recipe: ['pearl', 'rose'], reward: 35, gift: 6 },
    tea: { name: '玫瑰蜜茶', ch: '茶', recipe: ['honey', 'rose'], reward: 25, gift: 4 },
    tonic: { name: '安胎藥', ch: '藥', recipe: ['angelica', 'jujube'], reward: 42, gift: 8 },
    safflower: { name: '紅花', ch: '紅', recipe: ['petal', 'liquor'], out: 'inv' },
    junk: { name: '一坨黑黑的東西', ch: '黑', recipe: null },
  };
  const NORMAL_ORDERS = ['incense', 'cake', 'cream', 'tea'];

  const SHOP = ['sandalwood', 'ricefl', 'honey', 'pearl', 'jujube', 'liquor', 'stinky', 'musk'];

  // 採集表：[素材, 權重]
  const GATHER = {
    garden: {
      name: '御花園', bg: 'garden',
      table: [['jasmine', 3], ['osmanthus', 3], ['rose', 3], ['itch', 2]],
      intro: '零溶提著小籃子，假裝在御花園賞花……',
    },
    taiyi: {
      name: '太醫院', bg: 'taiyi',
      table: [['angelica', 3], ['croton', 2], ['petal', 1], ['musk', 0.6]],
      intro: '趁太醫打瞌睡，零溶偷偷拉開了百子櫃……',
    },
  };

  const CHARS = {
    lingrong: { name: '零溶', color: '#7b8fd1', face: '零', imgs: { smile: 'lingrong_smile', evil: 'lingrong_evil', shock: 'lingrong_shock' } },
    baojuan: { name: '包捐', color: '#5f9a7a', face: '捐', imgs: { _: 'baojuan' } },
    huafei: { name: '滑妃', color: '#d0453b', face: '滑', palace: '一捆宮', bg: 'yikun', imgs: { happy: 'huafei_happy', oops: 'huafei_oops' } },
    meizhuang: { name: '審沒裝', color: '#d99a2b', face: '審', palace: '嫌福宮', bg: 'xianfu', imgs: { happy: 'meizhuang_happy', oops: 'meizhuang_oops' } },
    zhenhuan: { name: '真環', color: '#e07f9c', face: '環', palace: '碎魚軒', bg: 'suiyu', imgs: { happy: 'zhenhuan_happy', oops: 'zhenhuan_oops' } },
    huangshang: { name: '黃上', color: '#d4a800', face: '黃', imgs: { _: 'huangshang', happy: 'huangshang_happy' } },
    huanghou: { name: '黃后', color: '#7a4e9a', face: '后', imgs: { _: 'huanghou' } },
    doctor: { name: '太醫溫十粗', color: '#4f7a8a', face: '溫', imgs: { _: 'doctor' } },
  };
  const TARGETS = ['huafei', 'meizhuang', 'zhenhuan'];
  const ALL = ['lingrong', ...TARGETS];

  const RULES = {
    days: 10,
    slotsPerDay: 3,
    silver: 100,
    favor: { lingrong: 15, huafei: 60, meizhuang: 40, zhenhuan: 45 },
    friend: { huafei: 10, meizhuang: 40, zhenhuan: 50 },
    // 滑妃開局就不孕（歡你香梗）
    status: { huafei: 'infertile', meizhuang: 'normal', zhenhuan: 'normal' },
    startInv: { sandalwood: 1, ricefl: 1, honey: 1, pearl: 1, jujube: 1, jasmine: 1, osmanthus: 1, rose: 1, angelica: 1 },
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
      itch: -8, stinky: -8, croton: -10,
    },
  };

  // ───────── 台詞 ─────────
  // 每句台詞格式：[說話者, 表情, 內容]；說話者 'narr' 是旁白
  const NEEDS = {
    huafei: {
      incense: '最近睡不好，一閉眼就看到真環那張臉',
      cake: '嘴饞得很',
      cream: '覺得臉上好像多了一條細紋',
      tea: '今天罵人罵到口乾舌燥',
    },
    meizhuang: {
      incense: '最近心裡煩悶，夜裡總睡不安穩',
      cake: '想念家鄉的點心',
      cream: '天氣乾燥，臉上有些緊繃',
      tea: '想喝些清甜的茶潤潤喉',
      tonic: '太醫說我有喜了，想要碗安胎藥補一補',
    },
    zhenhuan: {
      incense: '近來心事重重，總是睡不安穩',
      cake: '突然想吃點甜的',
      cream: '想讓皇上多看我兩眼',
      tea: '倚梅園的梅花謝了，想喝點花茶解解悶',
      tonic: '我有了身孕，想喝碗安胎藥',
    },
  };

  function request(who, productId) {
    const p = PRODUCTS[productId].name;
    const need = NEEDS[who][productId];
    if (who === 'huafei') return ['huafei', 'happy', `安嬪，本宮${need}。給本宮做個「${p}」送來，做不好仔細你的皮！`];
    if (who === 'meizhuang') return ['meizhuang', 'happy', `安嬪妹妹，${need}，能不能麻煩妹妹做個「${p}」？`];
    return ['zhenhuan', 'happy', `零溶妹妹，${need}，可否請妹妹做個「${p}」給我？`];
  }

  // 收下東西（交貨或送禮）時的反應
  const THANKS = {
    huafei: [['huafei', 'happy', '哼，還算你有點用處。'], ['lingrong', 'smile', '（……好無聊。）']],
    meizhuang: [['meizhuang', 'happy', '妹妹的手藝真好，難怪大家都誇妳。'], ['lingrong', 'smile', '姐姐喜歡就好。']],
    zhenhuan: [['zhenhuan', 'happy', '妹妹真是貼心。'], ['lingrong', 'smile', '姐姐別客氣，妹妹只是想對姐姐好。']],
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

  // 出糗類：每個人有自己的演出（白天收下時）
  const DEBUFF_LINES = {
    huafei: {
      itch: [['huafei', 'oops', '癢、癢死本宮了——！'], ['lingrong', 'evil', '（今晚可有好戲看了。）']],
      stinky: [['huafei', 'happy', '安嬪你看什麼看？本宮臉上有東西嗎？'], ['lingrong', 'evil', '（不是臉上，是嘴裡。）']],
      croton: [['huafei', 'oops', '本宮……本宮先失陪一下——！'], ['lingrong', 'evil', '（這就是囂張的下場。）']],
    },
    meizhuang: {
      itch: [['meizhuang', 'oops', '這、這實在有失體統……可是好癢……'], ['lingrong', 'evil', '（端莊不起來了吧。）']],
      stinky: [['meizhuang', 'happy', '妹妹，我今天讀了一首好詩——'], ['lingrong', 'evil', '（姐姐，口氣也很大方呢。）']],
      croton: [['meizhuang', 'oops', '失陪……失陪了……！'], ['lingrong', 'evil', '（呵呵。）']],
    },
    zhenhuan: {
      itch: [['zhenhuan', 'oops', '好癢……快來人幫我抓背……'], ['lingrong', 'evil', '（姐姐，扭得真好看。）']],
      stinky: [['zhenhuan', 'happy', '妹妹，我為妳吟一首——'], ['lingrong', 'evil', '（臭豆腐，YES！）']],
      croton: [['zhenhuan', 'oops', '妹妹恕罪，我……我去去就回！'], ['lingrong', 'evil', '（姐姐，聰明有什麼用呢？）']],
    },
  };

  // 夜晚侍寢出包
  const SERVE_FAIL = {
    itch: '{n}侍寢時狂抓背，黃上以為她長了跳蚤，連夜逃回癢心殿。',
    stinky: '{n}一開口，黃上當場暈了過去。',
    croton: '{n}侍寢到一半衝去茅房，黃上獨守空房到天亮。',
  };

  // 侍寢出包時黃上的反應（用他「嚇到逃跑」的立繪）
  const SERVE_FAIL_HS = {
    itch: '愛、愛妃妳別一直抓了！妳身上是不是有跳蚤？！',
    stinky: '這、這是什麼味道……朕……朕快不行了……',
    croton: '愛妃？愛妃妳要去哪——？留朕一個人在這裡嗎？！',
  };

  const EMPRESS = [
    ['huanghou', '_', '皇上，安嬪近日安分守己，又會唱曲，皇上也該去炎洗宮坐坐了。'],
    ['lingrong', 'shock', '（黃后娘娘……居然替我說話？她到底在打什麼算盤……）'],
  ];

  const SING = [
    ['lingrong', 'evil', '勸君莫惜金縷衣，勸君惜取少年時——'],
    ['huangshang', 'happy', '好！好一個金縷衣！朕今晚哪裡都不去了！'],
  ];

  const CAUGHT = [
    ['doctor', '_', '且慢！這東西裡……有{spike}！'],
    ['{who}', 'oops', '安嬪！妳竟然——！'],
    ['lingrong', 'shock', '冤、冤枉啊！一定是有人陷害臣妾！'],
    ['narr', '', '黃上震怒：安嬪禁足炎洗宮 {days} 天，好好反省！'],
  ];

  const TUTORIAL = [
    ['baojuan', '_', '小主！小主您醒啦！'],
    ['lingrong', 'smile', '包捐，本嬪在這後宮……是不是最不受寵的那一個？'],
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
    lingrong: '安嬪零溶恩寵冠絕六宮，即日起改姓鈕祜祿！',
    huafei: '滑妃恩寵冠絕六宮，晉為皇貴妃，一捆宮夜夜笙歌。',
    meizhuang: '審沒裝恩寵冠絕六宮，晉為惠妃，嫌福宮從此不嫌福。',
    zhenhuan: '真環恩寵冠絕六宮，晉為熹妃，碎魚軒門庭若市。',
  };
  // 對手第一時，零溶的處境（禁足優先）
  const END_LING = {
    grounded: '安嬪零溶尚在禁足，著閉門思過。',
    2: '安嬪零溶屈居第二，只差一點點。',
    3: '安嬪零溶位居第三，還得再加把勁。',
    4: '安嬪零溶恩寵墊底，炎洗宮依舊門可羅雀。',
  };
  // 第二層：封號。依序排列＝越前面越稀有，拿到多個時，第一個是主封號，其餘「另外加封」。
  // 判定條件寫在 game.js 的 TITLE_CHECK。
  const TITLES = [
    { id: 'shexiang', name: '麝香代言人', seal: '麝香|代言人', comment: '一劑一劑，耐心是美德。歡宜香的配方，從此由炎洗宮獨家監製。', hint: '據說有一種香，聞久了就……' },
    { id: 'shuangmian', name: '雙面零溶', seal: '雙面|零溶', comment: '姐姐們都說安嬪妹妹最貼心了。三位都中了招，卻沒有一個人懷疑妳。', hint: '表面姐妹情深，背地裡……而且一次都不能失手。' },
    { id: 'duanzi', name: '斷子絕孫專賣店', seal: '斷子絕孫|專賣店', comment: '炎洗宮出品，必屬佳品。後宮出生率創下歷史新低。', hint: '審沒裝和真環，好像都還生得出來……' },
    { id: 'wentaiyi', name: '溫太醫不要', seal: '溫太醫|不要', comment: '溫十粗太醫在炎洗宮門口擺了張桌子。妳一出門，他就搖頭。', hint: '被太醫抓到不只一次的話……' },
    { id: 'guimi', name: '後宮好閨蜜', seal: '後宮|好閨蜜', comment: '大家都好喜歡安嬪妹妹！……雖然黃上還是不太記得妳。', hint: '三位姐姐都跟妳很要好的話……' },
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
    '本嬪只是個平凡的煉金術士而已。',
    '姐姐們都對我好好喔……（呵）',
    '包捐，去把鍋子刷一刷。',
    '黃上什麼時候才會翻我的牌子呢？',
  ];

  return {
    ITEMS, PRODUCTS, NORMAL_ORDERS, SHOP, GATHER, CHARS, TARGETS, ALL, RULES,
    request, THANKS, REFUSE, EMPRESS, SING, OUTCOME_LINES, DEBUFF_LINES, SERVE_FAIL, SERVE_FAIL_HS, CAUGHT, TUTORIAL, END_TOP, END_LING, TITLES, IDLE,
  };
})();
