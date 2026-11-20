# 遊戲音樂生成 Prompt

> 適用：Suno、Udio、ElevenLabs Music、Stable Audio 等。英文 prompt 效果通常比較穩，所以 prompt 用英文，說明用中文。
> 生成後依檔名放進 `assets/audio/`，告訴我一聲，我會壓縮並統一音量。

## 通用設定

- **一律選純音樂（Instrumental）**，金縷衣那首例外。
- 長度 1.5～3 分鐘即可，遊戲會自動循環播放。
- 不要在 prompt 裡寫劇名、演員或作曲家名字：大部分平台會擋，也容易有版權疑慮。
- 每首多生成 3～4 個版本再挑。挑選標準：開頭不要太突然，結尾能自然接回開頭。
- Suno 有「Exclude styles」欄位的話，填進每首下面列的排除項。

---

## 1. `bgm_main.mp3`：主畫面（白天經營）★必要

整天都會聽到，所以要輕快、不吵、聽久了不煩。氣氛是「表面乖巧，其實在打壞主意」。

```
Playful Chinese palace instrumental, guzheng and pipa plucking with pizzicato strings,
light wood block and small hand drums, sneaky comedic mood, mischievous but cute,
medium tempo 100 BPM, bright major pentatonic with occasional sly chromatic notes,
loopable game background music, clean mix, no vocals
```
排除：`vocals, heavy drums, EDM, rock, sad, epic orchestral`

**備選風格**（想更搞笑時）：
```
Comedic Chinese court music for a mobile game, bouncy guzheng melody,
bassoon and pizzicato sneaking steps, erhu slides for humor, cartoonish and light,
110 BPM, loop-friendly, instrumental
```

---

## 2. `bgm_ending.mp3`：結局 ★必要

不管拿到哪種結局都會播，所以要「盛大中帶點荒謬」，像頒獎典禮。

```
Grand Chinese imperial fanfare turning playful, suona and gongs opening,
then guzheng and dizi melody over full strings, triumphant yet tongue-in-cheek,
like a comedic award ceremony in a palace, 90 BPM, satisfying ending cadence,
instrumental
```
排除：`vocals, dark, horror, EDM`

> 之後如果結局分「逆襲成功／失敗」，可以再做一首失敗版：
```
Melancholic but funny Chinese palace tune, solo erhu with sighing slides,
sparse guzheng, slow 70 BPM, bittersweet comedic defeat, a lonely concubine
in an empty courtyard, short loop, instrumental
```

---

## 3. `bgm_title.mp3`：標題頁（選做）

零溶的陰笑大立繪配上夜色宮殿：神祕、華麗，帶一點邪氣。

```
Mysterious Chinese palace night theme, slow guzheng arpeggios and low strings,
celesta sparkles like alchemy, a hint of villainous charm, elegant and dark-cute,
80 BPM, cinematic game title screen, loopable, instrumental
```
排除：`vocals, drums heavy, happy pop`

---

## 4. `bgm_workshop.mp3`：煉金工房（選做）

調合畫面用。要有冒泡、神祕實驗的感覺。

```
Whimsical alchemy workshop music, bubbling marimba and celesta,
guzheng harmonics, soft pizzicato, magical potion brewing,
curious and slightly sinister, 95 BPM, cozy game loop, instrumental
```

---

## 5. `bgm_night.mp3`：夜晚侍寢結算（選做）

翻牌子揭曉、侍寢出包的對話時播放。要曖昧又好笑。

```
Sultry yet comedic Chinese night music, slow erhu glissandos,
soft guqin and muted strings, gentle temple bells, palace bedroom intrigue
played for laughs, 72 BPM, loopable, instrumental
```

---

## 6. 短音效／過場（選做，3～8 秒）

| 檔名 | 用途 | Prompt |
|---|---|---|
| `sting_caught.mp3` | 被溫十粗抓到 | `Short comedic dramatic sting, sudden Chinese gong crash and descending erhu slide, "you got caught" moment, 4 seconds` |
| `sting_flip.mp3` | 公布翻牌子 | `Short Chinese drum roll then bright guzheng flourish, announcement reveal, 4 seconds` |
| `sting_birth.mp3` | 妃嬪生下皇嗣 | `Short celebratory Chinese firecracker and suona fanfare, ironic tone, 5 seconds` |

> 音效目前是程式合成的，換成檔案需要我改一下程式。要做的話再跟我說。

---

## 7. 金縷衣（選做，有人聲）

零溶侍寢時演唱的那首。歌詞是唐詩〈金縷衣〉，已是公版，可以直接用。

**歌詞欄：**
```
[Verse]
勸君莫惜金縷衣
勸君惜取少年時
[Chorus]
花開堪折直須折
莫待無花空折枝
```

**風格欄：**
```
Delicate Chinese classical ballad, sweet high female voice,
guzheng and dizi accompaniment, slow and graceful, palace banquet performance,
slightly over-dramatic, 70 BPM, short
```

> 用法：可以在演唱橋段播 15～20 秒的片段。要做的話也需要我改程式。
