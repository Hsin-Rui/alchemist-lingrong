---
name: 煉金術士零溶——逆襲a零溶
description: 手機直式優先的宮廷卷軸風惡搞小遊戲；本版只為鍵盤操作加上焦點框、為加料與被抓加上更誇張的演出，其餘外觀照舊。
status: final
updated: 2026-11-22
colors:
  paper: '#F6EEDF'
  card: '#FFFDF8'
  line: '#E2D3B5'
  ink: '#2E2228'
  muted: '#6E5F66'
  crimson: '#8E2B2B'
  crimson-dark: '#5E1A1A'
  gold: '#B8892E'
  ok: '#2F7A4F'
  red: '#B42B2B'
  purple: '#6B4FA0'
  purple-soft: '#F3ECFA'
  night: '#241B30'
  night-2: '#3A2D4B'
  night-line: '#4E3F63'
  lavender: '#B784F0'
  lavender-text: '#E6D6FF'
  amber: '#F4C66A'
  dim-veil: '#140C1C'
typography:
  body:
    fontFamily: "'Noto Sans TC', -apple-system, 'PingFang TC', 'Microsoft JhengHei', sans-serif"
  serif:
    fontFamily: "'Noto Serif TC', 'Songti TC', serif"
    fontWeight: 900
  dialog:
    fontSize: 17px
    lineHeight: 1.7
  button:
    fontSize: 15px
    fontWeight: 700
  button-big:
    fontSize: 17px
    fontWeight: 900
  stamp:
    fontFamily: "{typography.serif.fontFamily}"
    fontSize: 56px
    fontWeight: 900
  stamp-fierce:
    fontFamily: "{typography.serif.fontFamily}"
    fontSize: 72px
    fontWeight: 900
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  sheet: 22px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  gutter: 16px
components:
  focus-corners:
    color: "{colors.crimson}"
    colorOnDark: "{colors.amber}"
    armLength: 10px
    thickness: 3px
    inset: -5px
  stamp:
    borderWidth: 6px
    rounded: 12px
  stamp-fierce:
    borderWidth: 8px
    inkDots: 14
    inkDotSize: 5px–14px
  dim-veil:
    color: "{colors.dim-veil}"
    opacityVerdict: 0.45
    opacityAfterStamp: 0.62
  speed-toggle:
    shape: same as skip button (pill, {rounded.full})
---

## Brand & Style

宮廷卷軸質感的同人惡搞遊戲：白天是米色卷軸紙配朱紅與金，調合工房與夜晚是深紫。整體可愛、誇張、帶點壞心眼。**這一版不改既有外觀**；只新增兩樣東西——鍵盤的焦點框，以及壞事得逞或被抓時更有份量的演出。新增的東西一律從既有色票取色，不引進新色系。

## Colors

既有色票照舊（來源：`css/style.css` `:root`），本版新增的用法：

- **朱紅 `{colors.crimson}`**：焦點框四角在淺色面（卷軸紙、卡片、彈出視窗）上的顏色。
- **琥珀 `{colors.amber}`**：焦點框四角在深色面（底部導覽列、調合工房、夜晚、對話旁白框、結局）上的顏色。（朱紅在深色底上看不清楚，故深色面改用琥珀）
- **暗幕 `{colors.dim-veil}`**：只用於「被抓」時壓暗畫面。
- 章的顏色沿用：紅章 `{colors.red}`、紫章 `{colors.purple}`、金章 `{colors.gold}`、灰章。墨點與墨圈與該章同色。

不做閃色：任何事件都不用全畫面閃光。

## Typography

沿用現狀：內文 Noto Sans TC，標題、說話者名牌、章用 Noto Serif TC 900。對話字級 `{typography.dialog.fontSize}`。「狠章」比一般章大：`{typography.stamp-fierce.fontSize}`（紫章較長，維持 48px）。

## Layout & Spacing

沿用現狀：手機直式單欄，最寬 480px，左右 `{spacing.gutter}`。桌機也是同一個直式欄置中。本版不改版面；「倍速」按鈕放在「略過」按鈕左邊，同一列。

## Elevation & Depth

沿用現狀。暗幕位於畫面內容之上；章、收據、底部按鈕位於暗幕之上（不被壓暗）。

## Shapes

沿用現狀：按鈕 `{rounded.md}`、卡片 `{rounded.lg}`、底部彈出視窗上緣 `{rounded.sheet}`、略過與倍速按鈕為膠囊 `{rounded.full}`。焦點框是四個直角，不圓角——像選取框，不像按鈕外框。

## Components

- **焦點框（四角框）**：圍住目前選到的可按元素，往外 5px，四個角各一個 L 形，臂長 10px、粗 3px。淺色面用 `{colors.crimson}`，深色面用 `{colors.amber}`。不改變元素本身的大小、顏色與位置。只在鍵盤操作時出現（行為見 EXPERIENCE.md）。示意：[mockups/focus-options.html](mockups/focus-options.html)（選定 D）。
- **略過按鈕**：原「快轉 ≫」改字為「略過 ≫」，樣式不變。
- **倍速按鈕**：與略過同款膠囊，顯示目前速度「▶ 2×」或「▶ 瞬間」。
- **章（一般）**：沿用現狀，從 2.4 倍縮回。
- **狠章**：章從 4 倍、更斜的角度砸下，落到 0.9 倍時停格，再彈到 1.07 倍回到 1 倍；同時向外噴 14 顆墨點，並有一圈同色墨痕往外擴散到 1.6 倍後消失。示意：[mockups/fx-demo.html](mockups/fx-demo.html)。
- **暗幕**：被抓時壓暗背景與立繪，透明度見 `{components.dim-veil}`。

## Do's and Don'ts

| Do | Don't |
|---|---|
| 新東西從既有色票取色 | 為焦點或演出引進新色系 |
| 焦點框只畫四角，元素本身不動 | 焦點時放大、改色或移動按鈕 |
| 演出用立繪動作、停格、狠章、搖晃、被抓暗幕 | 全畫面閃色 |
| 搖晃只給最重的那一下 | 每句台詞或每次蓋章都晃 |
