// 採集地下城的像素美術（規範：docs/pixel-art-spec.md）。
// 純資料：每張圖是調色盤索引字串，'.' 是透明。不碰 DOM，Node 也能載入（tests/pixelart.test.js 會檢查格式）。
// 外殼在進場時把它畫成離屏 canvas 圖集；tools/pixel-preview.html 可以一次看全部。
(function () {
  'use strict';

  const palette = {
    '.': null,
    // 外框／深色
    k: '#1b1424', K: '#3a2b44',
    // 膚色
    s: '#f6d6bd', S: '#d9a283', b: '#f09a9a',
    // 頭髮
    h: '#2a2236', H: '#4a3d5c',
    // 零溶衣服
    l: '#a9cdec', L: '#6f9fd0', v: '#c6b2e6', V: '#9a84c9',
    // 白
    w: '#fbf7ef', W: '#d8d2c6',
    // 侍衛
    g: '#4f6a8a', G: '#33475f', r: '#d2453f', R: '#8e2a2e', y: '#e3b448', Y: '#a97a2a',
    // 草地
    1: '#82bd5c', 2: '#5e9e4e', 3: '#477f3d', 4: '#2f5a32',
    // 樹籬
    5: '#4e8f46', 6: '#2d6b3a', 7: '#1f4a2c',
    // 石色（月洞門、假山等）
    8: '#cfc4ad', 9: '#a89c86', 0: '#7d725f',
    // 水
    c: '#a9e0ee', a: '#5fa8c9', A: '#3c7aa3',
    // 花
    o: '#f2c14e', O: '#c98d2a', e: '#e0445a', E: '#a12a43', p: '#f08ab0',
    // 稀有（紫）
    i: '#b779d9', I: '#7a4aa8',
    // 石頭
    n: '#8f8a99', N: '#5e5a6b',
    // 宮牆／月洞門
    q: '#9e3a32', Q: '#6e2724', u: '#5a6170',
    // 太醫院：木頭、太醫官服、藥童短褂
    t: '#d1a26a', T: '#b3824c', d: '#7c5634', D: '#4f3622',
    f: '#5f93a3', F: '#3d6b7c', x: '#9db0a8', X: '#6d8480',
  };

  const sprites = {};
  const add = (id, w, h, rows) => { sprites[id] = { w, h, rows }; };

  // ───────── 地形圖塊（16×16）─────────
  add('grass_0', 16, 16, [
    '2222222222222222',
    '2212222222232222',
    '2222222322222222',
    '2222222222222122',
    '2322221222222222',
    '2222222222322222',
    '2222222222222222',
    '2122223222221222',
    '2222222222222222',
    '2222122222232222',
    '2232222221222222',
    '2222222222222222',
    '2222223222222122',
    '2212222222322222',
    '2222222122222222',
    '2222322222222232',
  ]);
  add('grass_1', 16, 16, [
    '2222222222222222',
    '2222222222212222',
    '2232222222222222',
    '2222222222222322',
    '2222222212222222',
    '2222322222222222',
    '2222222222222222',
    '2212222222w22222',
    '222222222wow2222',
    '2222222322w32222',
    '2322222222222222',
    '2222222222222212',
    '2222222222222222',
    '2222122222322222',
    '2222222221222222',
    '2222222222222222',
  ]);
  add('grass_2', 16, 16, [
    '2222222222222222',
    '2222222222222222',
    '2212222222322222',
    '2222222222222222',
    '2222221212222222',
    '2222212121222232',
    '2322213131222222',
    '2222231313222222',
    '2222223432222222',
    '2222222222222122',
    '2222222222222222',
    '2122222222121222',
    '2222322221213122',
    '2222222223131322',
    '2222222222343222',
    '2222222222222222',
  ]);
  add('hedge_top', 16, 16, [
    '6656666666566666',
    '6555666665556676',
    '5555676655555666',
    '6556666665556666',
    '6666665666666656',
    '6676655566676555',
    '6666555556665555',
    '6666655566666555',
    '6566665666766656',
    '5556666665666666',
    '5555676655566766',
    '6556666555556666',
    '6666665655566656',
    '6676655566666555',
    '6666555556766555',
    '6666655566666656',
  ]);
  add('hedge_face', 16, 16, [
    '5556655565556655',
    '5565556655655565',
    '6556665566556655',
    '6666566666665666',
    '7666666766666676',
    '6766676667666766',
    '7676767676767676',
    '6767676767676767',
    '7676767676767676',
    '7767776777677767',
    '7777777777777777',
    '7K777K777K777K77',
    'K7K7K7K7K7K7K7K7',
    'KKKKKKKKKKKKKKKK',
    'KkKkKkKkKkKkKkKk',
    'kkkkkkkkkkkkkkkk',
  ]);
  add('gate', 16, 16, [
    'QQuuuuuuuuuuuuQQ',
    'QqQuuuuuuuuuuQqQ',
    'Qqq0999999990qqQ',
    'Qqq9888888889qqQ',
    'Qq098888888890qQ',
    'Qq988888888889qQ',
    'Qq988898888889qQ',
    'Qq988888888889qQ',
    'Qq988888889889qQ',
    'Qq988888888889qQ',
    'Qq988888888889qQ',
    'Qq098888888890qQ',
    'Qqq9888888889qqQ',
    'Qqq0999999990qqQ',
    'QqQ0000000000QqQ',
    'QQQkkkkkkkkkkQQQ',
  ]);

  // ───────── 擺設 ─────────
  // 荷花池（32×32，佔 2×2 格）：兩幀只差水面波光
  const POND = [
    '................................',
    '..........kkkkkkkkkkkk..........',
    '.......kkknnnnnnnnnnnnkkk.......',
    '.....kknnnWWnnnnnnnnnnnnnkk.....',
    '....knnnWaaaaaaaaaaaaaannnNk....',
    '...knnWaaaaaaaaaaaaaaaaaannNk...',
    '..knnWaaaaaaaaaaaaaaaaaaaaanNk..',
    '..knWaaaaaaaaaaaaa5555aaaaaanNk.',
    '.knnaaaaaaaaaaaaa556655aaaaaanNk',
    '.knWaaaa555aaaaaa5666665aaaaanNk',
    '.knaaaa55655aaaaaa56665aaaaaanNk',
    '.knaaa5566665aaaaaa555aaaaaaanNk',
    '.knaaa5666665aaaaaaaaaaaaaaaAnNk',
    '.knaaaa56665aaaaaaaaaaaaaaaaAnNk',
    '.knaaaaa555aaaaaaaaaaaaaaaaAAnNk',
    '.knaaaaaaaaaaaaaaaaaaaaaaaaAAnNk',
    '.knaaaaaaaaaaaaaapaaaaaaaaaAAnNk',
    '.knaaaaaaaaaaaaapwpaaaaaaaAAAnNk',
    '.knAaaaaaaaaaa555p555aaaaaAAAnNk',
    '.knAaaaaaaaaa55665665aaaaAAAAnNk',
    '.knAAaaaaaaaa56666665aaaAAAAnNNk',
    '.knnAAaaaaaaaa566665aaaAAAAAnNk.',
    '..knAAAaaaaaaaa5555aaaAAAAAnNNk.',
    '..knnAAAAaaaaaaaaaaaAAAAAAnNNk..',
    '...knnAAAAAAaaaaaAAAAAAAAnNNk...',
    '....knnnAAAAAAAAAAAAAAAnnNNk....',
    '.....kkNnnnAAAAAAAAAnnnNNkk.....',
    '.......kkkNNNnnnnnNNNNkkk.......',
    '..........kkkkkkkkkkkk..........',
    '................................',
    '................................',
    '................................',
  ];
  const glint = (rows, marks) => rows.map((row, y) => {
    let out = row;
    marks.filter((m) => m[1] === y).forEach(([x, , len]) => { out = out.slice(0, x) + 'c'.repeat(len) + out.slice(x + len); });
    return out;
  });
  add('pond_0', 32, 32, glint(POND, [[9, 6, 4], [21, 13, 3], [6, 16, 3], [18, 22, 2]]));
  add('pond_1', 32, 32, glint(POND, [[12, 6, 4], [19, 14, 3], [8, 17, 3], [20, 23, 2]]));

  add('flowerbed', 16, 16, [
    '................',
    '...kkkkkkkkkk...',
    '..knnnnnnnnnNk..',
    '.kn5565w56556Nk.',
    '.kn56w5655e55Nk.',
    '.kn5565o5655wNk.',
    '.kne556556o56Nk.',
    '.kn565w556556Nk.',
    '.kn5o5565e565Nk.',
    '.kn5565w55655Nk.',
    '.kn56e556o556Nk.',
    '.kn5565565w56Nk.',
    '.knNNNNNNNNNNNk.',
    '..kNNNNNNNNNNk..',
    '...kkkkkkkkkk...',
    '................',
  ]);
  add('rock', 16, 24, [
    '................',
    '................',
    '................',
    '.......kk.......',
    '......knWk......',
    '.....knWnnk.....',
    '.....knnnNk.kk..',
    '....knWnnNkknk..',
    '...knWnnnNNknNk.',
    '...knnnnkNNnnNk.',
    '..knWnnnnkNnNNk.',
    '..knnnnnnNknNNk.',
    '..knnWnnnNNnNNk.',
    '.knnnnnnnnNNNNk.',
    '.knWnnnNnnnNNNk.',
    '.knnnnnNNnnnNNNk',
    '.knnnNnnNNnNNNNk',
    '.knnNNnnnNNNNNNk',
    '.kNnnnNNnNNNNNNk',
    '.kNNnNNNNNNNNNNk',
    '..kNNNNNNNNNNNk.',
    '...kkkkkkkkkkk..',
    '................',
    '................',
  ]);
  add('lantern', 16, 24, [
    '................',
    '................',
    '.......kk.......',
    '......knNk......',
    '.....kkWnkk.....',
    '....knWnnnNk....',
    '...knWnnnnnNk...',
    '..kkkkkkkkkkkk..',
    '....knkkkkNk....',
    '....knoyyoNk....',
    '....knoyyoNk....',
    '....knkkkkNk....',
    '...kkkkkkkkkk...',
    '...knWnnnnNNk...',
    '....kkknNkkk....',
    '......knNk......',
    '......knNk......',
    '......knNk......',
    '......knNk......',
    '....kkknNkkk....',
    '...knWnnnnNNk...',
    '..knnnnnnnnNNk..',
    '..kkkkkkkkkkkk..',
    '................',
  ]);

  // ───────── 角色（16×24；3 幀：站、左腳、右腳）─────────
  const frames = (id, body, feet) => feet.forEach((f, i) => add(`${id}_${i}`, 16, 24, [...body, ...f]));

  // 零溶：長裙蓋住腳，走路時露出白色花盆底鞋
  const LING_FEET = [
    ['..kkkkkkkkkkkk..', '................'],
    ['..kwwkkkkkkkkk..', '..kkk...........'],
    ['..kkkkkkkkkwwk..', '...........kkk..'],
  ];
  frames('ling_down', [
    '................',
    '...kkkkkkkkkk...',
    '..khhhhhhhwwhk..',
    '..khHhhhhwowwk..',
    '..kkhhhhhhwwkk..',
    '...khhhhhhhhk...',
    '..khhhhhhhhhhk..',
    '..khhsssssshhk..',
    '..khssssssssSk..',
    '..kssksssskssk..',
    '..kssksssskssk..',
    '..ksbssssssbSk..',
    '...kssssssSSk...',
    '....kksssskk....',
    '...kllkvvkllk...',
    '..klllvllvlllk..',
    '..klslllllLslk..',
    '..kkslllllLskk..',
    '...klllllllLk...',
    '...kllvllllLk...',
    '..kllllvlllLLk..',
    '..klllllllLLLk..',
  ], LING_FEET);
  frames('ling_up', [
    '................',
    '...kkkkkkkkkk...',
    '..khwwhhhhhhhk..',
    '..khhhhhhhhHhk..',
    '..kkhhhhhhhhkk..',
    '...khhhhhhhhk...',
    '..khhhhhhhhhhk..',
    '..khhhhhhhhhhk..',
    '..khhhHhhhhhhk..',
    '..khhhhhhhhhhk..',
    '..khhhhhhhhhhk..',
    '..kshhhhhhhhsk..',
    '...kshhhhhhsk...',
    '....kkhhhhkk....',
    '...kllkkkkllk...',
    '..kllllllllllk..',
    '..klslllllLslk..',
    '..kkslllllLskk..',
    '...klllllllLk...',
    '...klllvvllLk...',
    '..kllllllllLLk..',
    '..klllllllLLLk..',
  ], LING_FEET);
  frames('ling_left', [
    '................',
    '....kkkkkkkk....',
    '...khwwhhhhhk...',
    '...kwowhhhHhk...',
    '...kkhhhhhhkk...',
    '...khhhhhhhhk...',
    '..khhhhhhhhhhk..',
    '..kssshhhhhhhk..',
    '..ksssshhhhhhk..',
    '..kskssshhhhhk..',
    '..kskssshhhhhk..',
    '..kbsssshhhhhk..',
    '...ksssshhhhk...',
    '....kksskkkk....',
    '....kllllllk....',
    '...kllllllLLk...',
    '...klllsllLLk...',
    '...klllsllLLk...',
    '...kllllllLLk...',
    '...kvllllvLLk...',
    '..klllllllLLLk..',
    '..klllllllLLLk..',
  ], LING_FEET);

  // 侍衛：暖帽＋紅帽纓、石青勁裝、金腰帶、腰刀
  frames('guard_down', [
    '.......rr.......',
    '......krrk......',
    '....kkkRRkkk....',
    '...kKKKKKKKKk...',
    '..kKHKKKKKKKKk..',
    '.kkKKKKKKKKKKkk.',
    '.kKkkkkkkkkkkKk.',
    '..khsssssssshk..',
    '..kskksssskksk..',
    '..kssksssskssk..',
    '..kssssssssSSk..',
    '...kssskksSSk...',
    '....kkssSSkk....',
    '...kggkkkkggk...',
    '..kgggGggGgggk..',
    '..kgggGggGggGk..',
    '..ksgggggggGskn.',
    '..kkyyyYYyyykkn.',
    '...kgggggggGkN..',
    '...kggGkkGgGk...',
  ], [
    ['...kGGk..kGGk...', '...kGGk..kGGk...', '...kkkk..kkkk...', '................'],
    ['...kGGk..kGGk...', '...kGGk..kkkk...', '...kkkk.........', '................'],
    ['...kGGk..kGGk...', '...kkkk..kGGk...', '.........kkkk...', '................'],
  ]);
  frames('guard_up', [
    '.......rr.......',
    '......krrk......',
    '....kkkRRkkk....',
    '...kKKKKKKKKk...',
    '..kKKKKKKKKHKk..',
    '.kkKKKKKKKKKKkk.',
    '.kKkkkkkkkkkkKk.',
    '..khhhhhhhhhhk..',
    '..khhhhhhhhhhk..',
    '..kshhhhhhhhsk..',
    '..kshhhhhhhhsk..',
    '...kshhkkhhsk...',
    '....kkshhskk....',
    '...kggkhhkggk...',
    '..kgggghhggggk..',
    '..kgggghhgggGk..',
    '..ksggghhggGsk..',
    '..kkyyyYYyyykk..',
    '...kggghhggGk...',
    '...kggGkkGgGk...',
  ], [
    ['...kGGk..kGGk...', '...kGGk..kGGk...', '...kkkk..kkkk...', '................'],
    ['...kGGk..kGGk...', '...kGGk..kkkk...', '...kkkk.........', '................'],
    ['...kGGk..kGGk...', '...kkkk..kGGk...', '.........kkkk...', '................'],
  ]);
  frames('guard_left', [
    '......rr........',
    '.....krrk.......',
    '...kkkRRkkk.....',
    '..kKKKKKKKKk....',
    '.kKHKKKKKKKKk...',
    'kkKKKKKKKKKKkk..',
    'kKkkkkkkkkkkKk..',
    '..kssssshhhhk...',
    '..kkksssshhhk...',
    '..kskssshhhhk...',
    '..ksssssshhhk...',
    '..kkksssshhk....',
    '...kkssskkk.....',
    '....kgggggk.....',
    '...kggggggGk....',
    '...kggsgggGk....',
    '...kggsgggGkn...',
    '...kyyyyyYYkn...',
    '...kggggggGkN...',
    '...kggGkGgGk....',
  ], [
    ['...kGGk.kGGk....', '...kGGk.kGGk....', '...kkkk.kkkk....', '................'],
    ['...kGGk.kGGk....', '...kGGk.kkkk....', '...kkkk.........', '................'],
    ['...kGGk.kGGk....', '...kkkk.kGGk....', '........kkkk....', '................'],
  ]);
  ['ling', 'guard'].forEach((who) => [0, 1, 2].forEach((i) => { sprites[`${who}_right_${i}`] = { mirror: `${who}_left_${i}` }; }));

  add('shadow', 12, 4, [
    '...KKKKKK...',
    '.KKKKKKKKKK.',
    '.KKKKKKKKKK.',
    '...KKKKKK...',
  ]);

  // ───────── 素材（16×16）─────────
  add('jasmine', 16, 16, [
    '................',
    '................',
    '....kkk..kkk....',
    '...kwwwkkwwwk...',
    '...kwowkkwowk...',
    '...kwwwkkwwwk...',
    '....kkkwwkkk....',
    '...k5kwwowk5k...',
    '..k565kwwwk565k.',
    '..k5665kkk5665k.',
    '...k566k.k665k..',
    '....k55k.k55k...',
    '.....kk...kk....',
    '................',
    '................',
    '................',
  ]);
  add('osmanthus', 16, 16, [
    '................',
    '................',
    '.....kkkk.......',
    '....kooook.kk...',
    '...koOooOokook..',
    '...kooOoookoOk..',
    '...koOoooOkook..',
    '....kooOok.kk...',
    '..kk.kkkkkk.....',
    '.k55k.k6k.kkk...',
    '.k565kk6kk565k..',
    '..k5665k5665k...',
    '...k556k655k....',
    '....kkk6kkk.....',
    '......kkk.......',
    '................',
  ]);
  add('rose', 16, 16, [
    '................',
    '.....kkkkk......',
    '....keeeeek.....',
    '...keEeeeEek....',
    '...keeEpeeEk....',
    '...keEepeEek....',
    '...keeEeeEek....',
    '....keEEeek.....',
    '.....kkkkk.k....',
    '......k6k.k5k...',
    '...kk.k6kk56k...',
    '..k55kk6k565k...',
    '..k565k6k55k....',
    '...k55k6kkk.....',
    '....kkk6k.......',
    '......kkk.......',
  ]);
  const ITCH = [
    '................',
    '................',
    '................',
    '.....kyk........',
    '....kyYyk.......',
    '.....kyk........',
    '....kkikk.......',
    '...kiiiiik......',
    '..kiiwiiiIk.....',
    '..kiwiiiiIk.....',
    '..kiiiiiIIk.....',
    '..kiiiiIIIk.....',
    '...kIIIIIk......',
    '....kkkkk.......',
    '................',
    '................',
  ];
  const stamp = (rows, x, y, art) => rows.map((row, ry) => {
    const line = art[ry - y];
    return line ? row.slice(0, x) + line + row.slice(x + line.length) : row;
  });
  add('itch_0', 16, 16, stamp(ITCH, 10, 1, ['.w.', 'wcw', '.w.']));
  add('itch_1', 16, 16, stamp(stamp(ITCH, 11, 6, ['..w..', '..c..', 'wcwcw', '..c..', '..w..']), 1, 2, ['w']));

  // ───────── 氣泡與特效 ─────────
  add('bubble_alert', 8, 10, [
    '.kkkkkk.',
    'krrrrrrk',
    'krrwwrrk',
    'krrwwrrk',
    'krrwwrrk',
    'krrrrrrk',
    'krrwwrrk',
    'krrrrrrk',
    '.kkkrkk.',
    '....k...',
  ]);
  add('bubble_lost', 8, 10, [
    '.kkkkkk.',
    'kyykkyyk',
    'kykyykyk',
    'kyyyykyk',
    'kyyykyyk',
    'kyyykyyk',
    'kyyyyyyk',
    'kyyykyyk',
    '.kkkykk.',
    '....k...',
  ]);
  add('sparkle_0', 16, 16, [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......w........',
    '......wcw.......',
    '.......w........',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]);
  add('sparkle_1', 16, 16, [
    '................',
    '................',
    '................',
    '.......w........',
    '.......w........',
    '...w...c...w....',
    '.......w........',
    '...wwcwowcww....',
    '.......w........',
    '...w...c...w....',
    '.......w........',
    '.......w........',
    '................',
    '................',
    '................',
    '................',
  ]);
  add('sparkle_2', 16, 16, [
    '................',
    '.......w........',
    '................',
    '..w.........w...',
    '................',
    '................',
    '................',
    '.w.....c.....w..',
    '................',
    '................',
    '................',
    '..w.........w...',
    '................',
    '.......w........',
    '................',
    '................',
  ]);

  // ═════════ 太醫院（story 2.2；規範 §7）═════════
  // ───────── 地形圖塊（16×16）─────────
  add('ty_floor_0', 16, 16, [
    'tttttttttttttttt',
    'ttttttTttttttttt',
    'tttttttttttTtttt',
    'TTTTTTTdTTTTTTTT',
    'tttttttttttttttt',
    'tttTtttttttttttt',
    'tttttttttttttTtt',
    'TTTTTTTTTTTTTTdT',
    'tttttttttttttttt',
    'tttttttttTtttttt',
    'tttttttttttttttt',
    'TTTdTTTTTTTTTTTT',
    'tttttttttttttttt',
    'ttTttttttttttttt',
    'ttttttttttttTttt',
    'TTTTTTTTTTdTTTTT',
  ]);
  add('ty_floor_1', 16, 16, [
    'tttttttttttttttt',
    'tttttttttttTtttt',
    'ttTttttttttttttt',
    'TTTTTTTdTTTTTTTT',
    'tttttttttttttttt',
    'tttttTTTtttttttt',
    'ttttTddTTttttTtt',
    'TTTTTTTTTTTTTTdT',
    'tttttttttttttttt',
    'tttttttttttTTttt',
    'ttttttttttTdTttt',
    'TTTdTTTTTTTTTTTT',
    'tttttttttttttttt',
    'tttttTtttttttttt',
    'tttttttttttttttt',
    'TTTTTTTTTTdTTTTT',
  ]);
  add('ty_floor_2', 16, 16, [
    'tttttttttttttttt',
    'ttttttTttttttttt',
    'tttttttttttttttt',
    'TTTTTTTdTTTTTTTT',
    'tttttttttttttttt',
    'ttt2tttttttttttt',
    'tt232ttttttttTtt',
    'TTT3TTTTTTTTTTdT',
    'tttttttttttttttt',
    'ttttttttt2tttttt',
    'tttttttt323ttttt',
    'TTTdTTTTT2TTTTTT',
    'tttttttttttttttt',
    'ttTttttttttttttt',
    'tttttttttttttttt',
    'TTTTTTTTTTdTTTTT',
  ]);
  add('ty_wall_top', 16, 16, [
    'DDDDDDDDDDDDDDDD',
    'dddddddddddddddd',
    'ddddTddddddddddd',
    'dddddddddddTdddd',
    'dddddddddddddddd',
    'DDDDDDDDDDDDDDDD',
    'kkkkkkkkkkkkkkkk',
    'DDDDDDDDDDDDDDDD',
    'dddddddddddddddd',
    'dddddddTdddddddd',
    'dddddddddddddddd',
    'ddTddddddddddddd',
    'dddddddddddddddd',
    'DDDDDDDDDDDDDDDD',
    'kkkkkkkkkkkkkkkk',
    'DDDDDDDDDDDDDDDD',
  ]);
  // 百子櫃正面：一格格小抽屜加銅拉環
  add('ty_wall_face', 16, 16, [
    'DDDDDDDDDDDDDDDD',
    'DtttDtttDtttDttt',
    'DTyTDTyTDTyTDTyT',
    'DTTTDTTTDTTTDTTT',
    'DDDDDDDDDDDDDDDD',
    'DtttDtttDtttDttt',
    'DTyTDTyTDTyTDTyT',
    'DTTTDTTTDTTTDTTT',
    'DDDDDDDDDDDDDDDD',
    'DtttDtttDtttDttt',
    'DTyTDTyTDTyTDTyT',
    'DTTTDTTTDTTTDTTT',
    'DDDDDDDDDDDDDDDD',
    'dddddddddddddddd',
    'KKKKKKKKKKKKKKKK',
    'kkkkkkkkkkkkkkkk',
  ]);
  add('ty_door', 16, 16, [
    'DDaaaaaaaaaaaaDD',
    'DDaAaaaAaaaAaaDD',
    'DDaaaaaaaaaaaaDD',
    'DDaAaaaAaaaAaaDD',
    'DDAaAaAaAaAaAaDD',
    'DDttttttttttttDD',
    'DDttttttttttttDD',
    'DDtttTttttttttDD',
    'DDttttttttttttDD',
    'DDTTTTTTTTTTTTDD',
    'DDttttttttttttDD',
    'DDttttttTtttttDD',
    'DDttttttttttttDD',
    'DDddddddddddddDD',
    'DDyddddddddddyDD',
    'DDDDDDDDDDDDDDDD',
  ]);

  // ───────── 擺設 ─────────
  // 煎藥爐台（32×32）：磚砌爐台、兩個藥壺、兩個爐口；爐火與蒸氣 2 幀
  const STOVE = (() => {
    const rows = [];
    for (let y = 0; y < 32; y++) {
      let row = '';
      for (let x = 0; x < 32; x++) {
        const inX = x >= 1 && x <= 30;
        if (y < 6 || y > 29 || !inX) row += '.';
        else if (y === 6 || y === 29 || x === 1 || x === 30) row += 'k';
        else if (y === 18) row += 'k';
        else if (y < 18) row += (x + y) % 7 === 0 ? 'W' : 'n';
        else row += (y % 4 === 3 || (x + (y % 8 < 4 ? 0 : 4)) % 8 === 0) ? 'k' : 'N';
      }
      rows.push(row);
    }
    return rows;
  })();
  const POT = [
    '...kkkkk...',
    '.kkKKKKKkk.',
    'kKKdddddKKk',
    'kKdTdddddKk',
    'kKdddddddKk',
    'kKKdddddKKk',
    '.kkKKKKKkk.',
    '...kkkkk...',
  ];
  const FIRE = [
    ['kkkkkkk', 'kkeoekk', 'keoooek', 'koowook', 'koowook', 'keoooek', 'kkeeekk', 'kkkkkkk'],
    ['kkkkkkk', 'kkkekkk', 'kkeoekk', 'keowoek', 'koowook', 'kooooek', 'kkeoekk', 'kkkkkkk'],
  ];
  const STEAM = [['.w...', '..W..', '.w...', '..w..'], ['..w..', '.W...', '..w..', '.w...']];
  [0, 1].forEach((f) => {
    let rows = stamp(stamp(STOVE, 3, 8, POT), 18, 8, POT);
    rows = stamp(stamp(rows, 5, 20, FIRE[f]), 20, 20, FIRE[1 - f]);
    rows = stamp(stamp(rows, 6, 2, STEAM[f]), 21, 2, STEAM[1 - f]);
    add(`ty_stove_${f}`, 32, 32, rows);
  });
  add('ty_basket', 16, 16, [
    '................',
    '....2..3...2....',
    '...232.32.232...',
    '...2323232323...',
    '..kkkkkkkkkkkk..',
    '..kOoOoOoOoOok..',
    '..kkkkkkkkkkkk..',
    '...koOoOoOoOk...',
    '...kOoOoOoOok...',
    '...koOoOoOoOk...',
    '...kOoOoOoOok...',
    '...koOoOoOoOk...',
    '....kOoOoOok....',
    '....kkkkkkkk....',
    '................',
    '................',
  ]);
  add('ty_mortar', 16, 24, [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...........kk...',
    '..........kWk...',
    '...kkkkkkkWkk...',
    '...knnnnnWnnk...',
    '...kNnnnnnnNk...',
    '....kNnnnnNk....',
    '....kkNNNNkk....',
    '.kkkkkkkkkkkkkk.',
    '.kttttttttttttk.',
    '.ktTttttttTtttk.',
    '.kTTTTTTTTTTTTk.',
    '.kkkkkkkkkkkkkk.',
    '..kdk......kdk..',
    '..kdk......kdk..',
    '..kdk......kdk..',
    '..kdk......kdk..',
    '..kkk......kkk..',
    '................',
  ]);
  add('ty_candle', 16, 24, [
    '................',
    '................',
    '................',
    '................',
    '.......oo.......',
    '......owwo......',
    '......oeeo......',
    '.......oo.......',
    '.......kk.......',
    '......kwwk......',
    '......kwWk......',
    '......kwWk......',
    '.....kkyykk.....',
    '....kyyyyyYk....',
    '.....kkyYkk.....',
    '......kyYk......',
    '......kyYk......',
    '......kyYk......',
    '......kyYk......',
    '......kyYk......',
    '.....kkyYkk.....',
    '....kyyyyYYk....',
    '....kkkkkkkk....',
    '................',
  ]);

  // ───────── 角色 ─────────
  // 藥童：瓜皮小帽、灰青短褂、抱著藥包；比大人矮 2 像素
  const legs = (c, side) => (side
    ? [[`...k${c}${c}k.k${c}${c}k....`, `...k${c}${c}k.k${c}${c}k....`, '...kkkk.kkkk....', '................'],
      [`...k${c}${c}k.k${c}${c}k....`, `...k${c}${c}k.kkkk....`, '...kkkk.........', '................'],
      [`...k${c}${c}k.k${c}${c}k....`, `...kkkk.k${c}${c}k....`, '........kkkk....', '................']]
    : [[`...k${c}${c}k..k${c}${c}k...`, `...k${c}${c}k..k${c}${c}k...`, '...kkkk..kkkk...', '................'],
      [`...k${c}${c}k..k${c}${c}k...`, `...k${c}${c}k..kkkk...`, '...kkkk.........', '................'],
      [`...k${c}${c}k..k${c}${c}k...`, `...kkkk..k${c}${c}k...`, '.........kkkk...', '................']]);
  frames('page_down', [
    '................',
    '................',
    '.......kk.......',
    '.....kkKKkk.....',
    '....kKKKKKKk....',
    '...kKKHKKKKKk...',
    '...kkkkkkkkkk...',
    '..khsssssssshk..',
    '..kssssssssssk..',
    '..kssksssskssk..',
    '..kssksssskssk..',
    '..ksbssssssbSk..',
    '...kssssssSSk...',
    '....kksssskk....',
    '...kxxkxxkxxk...',
    '..kxxxxXxxxxxk..',
    '..kxswwwwwwsXk..',
    '..kkxwwWWwwXkk..',
    '...kxxxxxxxXk...',
    '...kxxXkkXxXk...',
  ], legs('X', false));
  frames('page_up', [
    '................',
    '................',
    '.......kk.......',
    '.....kkKKkk.....',
    '....kKKKKKKk....',
    '...kKKKKKHKKk...',
    '...kkkkkkkkkk...',
    '..khhhhhhhhhhk..',
    '..khhhhhhhhhhk..',
    '..kshhhhhhhhsk..',
    '..kshhhhhhhhsk..',
    '...khhhhhhhhk...',
    '....kkhhhhkk....',
    '....kkshhskk....',
    '...kxxkhhkxxk...',
    '..kxxxxhhxxxxk..',
    '..kxxxxhhxxxXk..',
    '..ksxxxxxxxXsk..',
    '...kxxxxxxxXk...',
    '...kxxXkkXxXk...',
  ], legs('X', false));
  frames('page_left', [
    '................',
    '................',
    '......kk........',
    '....kkKKkk......',
    '...kKKKKKKk.....',
    '..kKHKKKKKKk....',
    '..kkkkkkkkkk....',
    '..kssssshhhhk...',
    '..kkksssshhhk...',
    '..kskssshhhhk...',
    '..ksssssshhhk...',
    '..kkksssshhk....',
    '...kkssskkk.....',
    '....kxxxxxk.....',
    '...kxxxxxxXk....',
    '..kwwsxxxxXk....',
    '..kwWsxxxxXk....',
    '...kkxxxxxXk....',
    '...kxxxxxxXk....',
    '...kxxXkXxXk....',
  ], legs('X', true));

  // 太醫溫十粗：黑官帽紅頂珠、八字鬍、藍綠官服配補子、背藥箱
  const ROBE = [
    ['...kfFFffFFFk...', '...kkkkkkkkkk...', '....kkk..kkk....', '................'],
    ['...kfFFffFFFk...', '...kkkkkkkkkk...', '....kkk.........', '................'],
    ['...kfFFffFFFk...', '...kkkkkkkkkk...', '.........kkk....', '................'],
  ];
  frames('doctor_down', [
    '.......rr.......',
    '.....kkrrkk.....',
    '....khhhhhhk....',
    '...khhhHhhhhk...',
    '..kkkkkkkkkkkk..',
    '..kKKKKKKKKKKk..',
    '..kkkkkkkkkkkk..',
    '..khsssssssshk..',
    '..kskksssskksk..',
    '..kssksssskssk..',
    '..kssssssssSSk..',
    '..kshhsssshhSk..',
    '....kkssSSkk....',
    '...kffkwwkffk...',
    '..kffffFFffffk..',
    '..kfffyYYyffFkkk',
    '..ksffyYYyffskTk',
    '..kkffffffffkkTk',
    '...kfffffffFkkkk',
    '...kffFffFfFk...',
  ], ROBE);
  frames('doctor_up', [
    '.......rr.......',
    '.....kkrrkk.....',
    '....khhhhhhk....',
    '...khhhhHhhhk...',
    '..kkkkkkkkkkkk..',
    '..kKKKKKKKKKKk..',
    '..kkkkkkkkkkkk..',
    '..khhhhhhhhhhk..',
    '..khhhhhhhhhhk..',
    '..kshhhhhhhhsk..',
    '..kshhhhhhhhsk..',
    '...kshhkkhhsk...',
    '....kkshhskk....',
    '...kffkhhkffk...',
    '..kffffhhffffk..',
    'kkkffffhhfffFk..',
    'kTksfffffffFsk..',
    'kTkkffffffffkk..',
    'kkkkfffffffFk...',
    '...kffFffFfFk...',
  ], ROBE);
  frames('doctor_left', [
    '......rr........',
    '....kkrrkk......',
    '...khhhhhhk.....',
    '..khhHhhhhhk....',
    '.kkkkkkkkkkkk...',
    '.kKKKKKKKKKKk...',
    '.kkkkkkkkkkkk...',
    '..kssssshhhhk...',
    '..kkksssshhhk...',
    '..kskssshhhhk...',
    '..ksssssshhhk...',
    '..khhssssshk....',
    '...kkssskkk.....',
    '....kfffffk.....',
    '...kffffffFk....',
    '...kffsfffFkkk..',
    '...kffsfffFkTk..',
    '...kffffffFkTk..',
    '...kffffffFkkk..',
    '...kffFfFfFk....',
  ], [
    ['...kfFFfFFFk....', '...kkkkkkkkk....', '....kkk.kkk.....', '................'],
    ['...kfFFfFFFk....', '...kkkkkkkkk....', '....kkk.........', '................'],
    ['...kfFFfFFFk....', '...kkkkkkkkk....', '........kkk.....', '................'],
  ]);
  ['page', 'doctor'].forEach((who) => [0, 1, 2].forEach((i) => { sprites[`${who}_right_${i}`] = { mirror: `${who}_left_${i}` }; }));

  // ───────── 素材 ─────────
  add('angelica', 16, 16, [
    '................',
    '................',
    '.....kk..kk.....',
    '....k8wkkw8k....',
    '....kw8ww8wk....',
    '.....kwwwwk.....',
    '.....krrrrk.....',
    '.....kwwwwk.....',
    '....kw8ww8wk....',
    '....kwkw8kwk....',
    '...k8k.kwk.k8k..',
    '...kwk.k8k.kwk..',
    '...kk..kwk..kk..',
    '.......kkk......',
    '................',
    '................',
  ]);
  add('croton', 16, 16, [
    '................',
    '................',
    '................',
    '.........kk.....',
    '........k21k....',
    '.......k2123k...',
    '.......k223k....',
    '....kk..kkk.....',
    '...kdTk.........',
    '...kddk..kk.....',
    '....kk..kdTk....',
    '..kk....kddk....',
    '.kdTk....kk.....',
    '.kddk...........',
    '..kk............',
    '................',
  ]);
  add('petal', 16, 16, [
    '................',
    '................',
    '................',
    '................',
    '......kk........',
    '.....keek..kk...',
    '....keoeek.keek.',
    '....keeEk.keoek.',
    '.....kkk..keEk..',
    '...kk......kk...',
    '..keek.kkk......',
    '..keoekeoek.....',
    '...kEk.kEEk.....',
    '....k...kk......',
    '................',
    '................',
  ]);
  const MUSK = [
    '................',
    '................',
    '................',
    '....k.....k.....',
    '...kIk...kIk....',
    '...kiIkkkIik....',
    '....kyyyyyk.....',
    '...kkiiiiikk....',
    '..kiiiiiiiiIk...',
    '..kiiwiiiiiIk...',
    '..kiwiiyiiIIk...',
    '..kiiiiiiiIIk...',
    '..kiiiiiiIIIk...',
    '...kIIIIIIIk....',
    '....kkkkkkk.....',
    '................',
  ];
  add('musk_0', 16, 16, stamp(MUSK, 12, 0, ['.w.', 'wcw', '.w.']));
  add('musk_1', 16, 16, stamp(stamp(MUSK, 11, 5, ['..w..', '..c..', 'wcwcw', '..c..', '..w..']), 0, 4, ['w']));


  const anims = {
    water: ['pond_0', 'pond_1'],
    rare: ['itch_0', 'itch_1'],
    stove: ['ty_stove_0', 'ty_stove_1'],
    musk: ['musk_0', 'musk_1'],
    sparkle: ['sparkle_0', 'sparkle_1', 'sparkle_2'],
  };

  // 規範 §3 的必備清單（測試與預覽頁用）
  const required = [
    'grass_0', 'grass_1', 'grass_2', 'hedge_top', 'hedge_face', 'gate',
    'pond_0', 'pond_1', 'flowerbed', 'rock', 'lantern',
    ...['ling', 'guard'].flatMap((who) => ['down', 'up', 'left', 'right'].flatMap((d) => [0, 1, 2].map((i) => `${who}_${d}_${i}`))),
    'shadow', 'jasmine', 'osmanthus', 'rose', 'itch_0', 'itch_1',
    'bubble_alert', 'bubble_lost', 'sparkle_0', 'sparkle_1', 'sparkle_2',
    // 太醫院（規範 §7）
    'ty_floor_0', 'ty_floor_1', 'ty_floor_2', 'ty_wall_top', 'ty_wall_face', 'ty_door',
    'ty_stove_0', 'ty_stove_1', 'ty_basket', 'ty_mortar', 'ty_candle',
    ...['page', 'doctor'].flatMap((who) => ['down', 'up', 'left', 'right'].flatMap((d) => [0, 1, 2].map((i) => `${who}_${d}_${i}`))),
    'angelica', 'croton', 'petal', 'musk_0', 'musk_1',
  ];

  const PIXEL = { palette, sprites, anims, required };
  if (typeof module !== 'undefined' && module.exports) module.exports = PIXEL;
  if (typeof window !== 'undefined') window.PIXEL_ART = PIXEL;
})();
