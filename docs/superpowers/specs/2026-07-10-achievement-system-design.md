# Earth Online Achievement System v0.1 Design

Date: 2026-07-10

## Purpose

Earth Online needs an achievement system that feels like a personal archive of real-life events, not a heavy game loop. The system should make past experiences feel collectible and meaningful while preserving the current product tone: light, local-first, visually expressive, and not overcomplicated.

The achievement system is named **Night Archive** in product language. The daily panel remains the daytime operating surface for tasks, status, and maintenance. Achievements live in the nighttime archive: a deeper mode where old saves, trophies, rarity, and identity records are stored.

## Design Principles

1. **Achievements are save-file fragments, not proof of superiority.**
   They record life events and identity signals in a playful Earth Online frame.

2. **Black-gold is a nighttime archive language, not the whole product brand.**
   The current morning panel keeps its light glass style. The achievement system enters through a day-to-night transition so the contrast feels intentional.

3. **The system does not judge sensitive content automatically.**
   Users decide whether an achievement is private, hidden, displayed, or eligible for spotlight.

4. **The first version favors curation over scale.**
   The initial pool uses 49 old-save achievements inspired by the supplied screenshots. Runtime achievements remain extensible but limited in v0.1.

5. **No economy inflation.**
   Achievements do not grant experience, coins, or lottery items. Rewards are presentation rights: titles, tags, and display slots.

## Confirmed Product Decisions

### Overall Mode

The achievement feature is a **Night Archive**:

- Daytime mode: morning glass panel, daily maintenance, sync rate, level, tasks.
- Nighttime mode: deep blue Earth night side, city lights, black-gold archive cards.
- The transition should feel like switching lights off and entering night-side records.

The selected transition direction is **Night Side Pass**:

- The morning panel dims and desaturates.
- The Earth shifts toward its night hemisphere.
- City lights emerge gradually.
- A restrained scan line crosses the surface.
- The black-gold achievement card rises from the night-side signal.

This transition should be smooth and premium, not flashy. Recommended duration is about 900-1200ms.

### Visual Language

The outer frame should remain tied to Earth Online:

- Deep blue night-side Earth background.
- Sparse city-light points.
- Subtle orbital or scan lines.
- Low-noise dark atmosphere.

Achievement content uses black-gold:

- Black card background.
- Gold icon frame.
- Gold trophy/rarity accent.
- White title and description.
- Minimal star/spark details.

Black-gold should be concentrated in achievement content. Full-screen gold decoration should be avoided.

### Asset Strategy

The 49 supplied screenshots are a reference library only. They should not become final shipped UI assets.

Final achievement icons should be generated with GPT Image 2 using a unified prompt system:

- Square icon.
- Black background.
- Gold silhouette.
- Thin gold frame.
- Small star accents.
- No text in the image.
- Strong readability at small sizes.
- Theme-specific subject, such as diploma, driving license, language books, tent, concert, or old friendship.

The web UI renders all title, description, and rarity text. Text should not be baked into generated images.

### Initial Old-Save Flow

The first profile setup can unlock a batch of **old-save achievements**.

The scan flow is:

1. User enters old-save scan.
2. User sees life-domain cards rather than a long checklist.
3. User selects experienced life nodes inside each domain.
4. User starts old-save scan.
5. Night-side transition runs.
6. The system proposes likely unlocked achievements.
7. User can keep, remove, mark private, mark displayable, or manually add missed achievements.
8. The system spotlights 1-3 representative achievements.
9. Remaining confirmed achievements are silently archived.

The result page should show proposed unlocks first. A secondary **Add Missed Achievements** area lets the user expand the full 49-item pool by category.

### Privacy and Display

The system does not decide which achievements are sensitive.

Each achievement instance can carry user-controlled presentation flags:

- `private`: hidden from spotlight and public-facing display areas.
- `displayable`: eligible for profile or panel display.
- `spotlightAllowed`: eligible for initial unlock ceremony.

By default, achievements can be archived and displayed normally. The confirmation UI should make privacy controls easy to access without implying shame.

### Rarity

Rarity uses fixed simulated percentages.

Display text:

> 约 xx% 的玩家拥有此成就

The app does not need real network statistics. The simulated value is part of the Earth Online fiction and should stay lightweight.

### Rewards

Achievements do not provide experience, coins, or lottery items.

Allowed rewards:

- Unlock a title.
- Unlock a tag.
- Become eligible for profile display.
- Become eligible for a recent-achievement module.

Examples:

- `NPC过滤器` can unlock the title `NPC过滤器`.
- `安装语言包DLC` can unlock a tag such as `多语言接口`.
- `首次远行` can unlock a tag such as `地图探索者`.
- `旧存档扫描完成` can reinforce the title `旧存档持有者`.

## Achievement Pool v0.1

The initial pool contains 49 old-save achievements, grouped by Earth Online display category.

### 学业副本

- 难道我是天才？
- 学有所成
- 这样子卷？

### 职业主线

- 第一份工
- 异乡打工人
- 通宵达人

### 资源系统

- 经济断奶
- 全款置业
- 月光战神
- 外卖至尊VIP
- 零负债人生
- 财富自由

### NPC 羁绊

- 初恋支线
- 亲密羁绊
- 长期单身常驻
- 真心羁绊
- 故人走散
- 遗憾离场
- 双向钟情
- 极简社交者

### 家族支线

- 子嗣DLC
- 爱你老妈明天见
- 血之哀

### 地图探索

- 海外打卡
- 首次远行
- 说走就走
- 山野露营
- 顶峰登临
- 落日收藏家

### 技能 DLC / 兴趣支线

- 厨艺觉醒
- 初心未改
- 安装语言包DLC
- 守住热爱
- 乐坛赴约
- 观影达人
- 安装乐器DLC
- 垂钓闲人

### 身体容器 / 运行状态

- 我停不下来
- 人形闹钟
- 不眠者
- 嗜睡者

### 精神状态 / 异常剧情

- 空想行动派
- 拖延症
- 自我救赎
- 误闯新世界

### 陪伴与生活存档

- 无声的陪伴
- 驾照猎人
- 资深玩家

## Achievement Data Shape

Each achievement definition should include:

```js
{
  id: "driver-license-hunter",
  title: "驾照猎人",
  description: "通关机动载具副本，解锁现实地图驾驶权限。",
  category: "map_exploration",
  displayCategory: "地图探索",
  source: "old_save",
  rarityPercent: 53,
  spotlightWeight: 68,
  iconPromptSubject: "driving license, small car, road permission",
  unlockSignals: ["has_driver_license"],
  grants: {
    titles: [],
    tags: ["地图驾驶权限"]
  }
}
```

Achievement instances in a save can include:

```js
{
  id: "driver-license-hunter",
  unlockedAt: "2026-07-10T12:00:00.000Z",
  source: "old_save_scan",
  private: false,
  displayable: true,
  spotlightAllowed: true
}
```

This keeps static achievement definitions separate from user-specific unlock state.

## Spotlight Selection

Old-save scan should not play every unlocked achievement. It should spotlight 1-3 representative achievements and archive the rest.

Eligibility:

- Confirmed unlocked.
- Not marked private.
- `spotlightAllowed` is true.
- Not manually removed from the scan result.

Scoring:

```txt
score =
  spotlightWeight
  + (100 - rarityPercent) * 0.4
  + categoryCoverageBonus
```

Selection behavior:

- Prefer lower rarity percentages.
- Prefer high `spotlightWeight`.
- Prefer different categories.
- Avoid spotlighting several achievements from the same domain if a balanced set exists.
- User privacy and display choices override scoring.

## UI Surfaces

### Day Panel Entry

The day panel should keep daily tasks primary. The achievement entry is lightweight:

- `夜间档案` or `成就档案` entry.
- A small module can show `成就库 8/49` and recent unlocks.
- The entry triggers the night-side transition.

### Night Archive

The achievement archive uses list-first browsing because the user preferred the long black-gold achievement card style.

The initial archive can use:

- Category filter rail or tabs.
- Long achievement cards.
- Locked or hidden states.
- Private/display toggles in details.
- Search or filtering can be deferred until the pool grows beyond v0.1.

### Unlock Notifications

Notification levels:

- Runtime ordinary achievement: low-disruption toast.
- Representative old-save achievement: central black-gold ceremony after night-side transition.
- Non-representative old-save achievements: silently archived.

## Content Voice

Titles may keep the best reference wording when it has personality:

- 外卖至尊VIP
- 安装语言包DLC
- 第一份工
- 零负债人生
- 顶峰登临

Descriptions should be rewritten into Earth Online language. They should be short and not over-explain.

Examples:

- `第一份工`: 首次接入职业主线，开始稳定换取资源点。
- `安装语言包DLC`: 安装第二语言包，扩大跨服沟通范围。
- `故人走散`: 一段早期羁绊停止同步，但仍保留在旧存档中。
- `驾照猎人`: 通关机动载具副本，解锁现实地图驾驶权限。

The voice is **black humor plus gentle collection**:

- Funny achievements can be slightly sharp.
- Relationship, grief, isolation, money stress, and recovery achievements should be restrained.
- The system records; it does not mock the user.

## Risks and Detail Checkpoints

These are not blockers for the v0.1 concept, but they must be handled before implementation.

1. **Transition quality**
   The night-side transition must be tested visually. A simple fade will feel cheap.

2. **Black-gold contrast**
   The Night Archive must still feel connected to Earth Online. Use deep-blue Earth context around black-gold content.

3. **Scan fatigue**
   The old-save scan must avoid becoming a long questionnaire. Domain cards and result correction should carry the flow.

4. **Sensitive achievements**
   Do not auto-hide based on content. Give users clear privacy controls.

5. **Asset consistency**
   GPT Image 2 prompts need a repeatable generation format. Icons should not include text.

6. **Screenshot reuse**
   Supplied screenshots should not be shipped as final public assets. Use them only as visual references.

7. **Data migration**
   Existing saves already have a simple achievement array. Implementation must merge old achievement records without losing user data.

8. **Scope control**
   v0.1 should implement old-save archive and a small runtime extension point, not a large achievement automation engine.

## Implementation Readiness

This design is approved as a direction, not as a pixel-perfect spec. Before coding, the next implementation plan should break the work into small vertical slices:

1. Achievement definitions and save model.
2. Old-save scan data mapping.
3. Night Archive entry and transition prototype.
4. Achievement list view.
5. Scan result confirmation view.
6. Spotlight notification flow.
7. GPT Image 2 prompt library and generated icon asset pipeline.

Each slice should be independently testable and visually reviewed.
