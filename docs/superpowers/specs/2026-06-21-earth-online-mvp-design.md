# Earth Online MVP Design

Date: 2026-06-21

## Purpose

Earth Online is a lightweight local-first personal operating system with a cinematic Earth entry point. It should feel like entering a quiet global system terminal rather than opening a normal web app, todo list, or game dashboard.

The first MVP must deliver a closed loop:

- A brighter, more cinematic rotating Earth home screen.
- A dynamic "GLOBAL PLAYERS ONLINE" population readout.
- A reliable double-click entry flow with a visible exit path.
- A first-run player profile initialization flow.
- A local task panel that publishes daily tasks.
- EXP, levels, achievements, titles, and tags.
- Local save, import, and export.

## Hard Constraints

### Open-source-first implementation

Do not hand-roll core visual systems when solid open-source references exist.

Use open-source references first, then adapt:

- Earth rendering: `three-globe` / `globe.gl`.
- Earth examples: clouds, custom material, day/night cycle, satellites, arc links, and rings from `three-globe` examples.
- Earth textures: public/official textures where possible, such as Blue Marble, night lights, cloud layers, or other public Earth datasets.
- Satellite chain: borrow from `three-globe` satellites/arcs/rings patterns rather than inventing from scratch.
- Local persistence: use lightweight browser storage and readable JSON export/import.

Only project-specific glue logic should be written from scratch: state transitions, task generation, profile import, level calculation, achievement unlocking, and save migration.

When a non-real visual asset is needed, such as system panel texture, atmospheric background, badge art, or theme image, use image generation instead of low-quality hand-drawn SVG decoration.

If an image-generation asset is needed, use the available image generation tool (`imagegen` / image2-style workflow) and save the generated asset as part of the local project.

Before implementing a major visual feature, record the chosen GitHub or public-data reference in the project reference notes. This keeps the build anchored to existing open-source work instead of drifting into ad hoc visual invention.

### Local-first and lightweight

The app runs locally in the browser. The MVP should avoid a database, accounts, cloud sync, or heavy backend. Browser storage is the default persistence layer.

### Not a normal webpage

Avoid landing-page structure, marketing sections, nested cards, decorative blob backgrounds, and generic dashboard styling. The experience should feel like a system terminal over an orbital Earth scene.

### Not a full game

There is no combat, inventory, marketplace, random loot, stamina, or social system in the MVP. Growth is based on daily task completion and self-confirmed real-life milestones.

## Home Screen

The home screen is the first-viewport experience.

Required elements:

- A real-looking rotating Earth.
- Brighter lighting than the current prototype.
- Visible ocean, land, cloud, and atmosphere layers.
- City/night-light points or texture, especially around population-dense regions.
- A restrained satellite-chain or orbit-line effect.
- Minimal text:
  - `地球 Online`
  - `请勿在NPC身上浪费过多时间`
- System population readout:
  - `GLOBAL PLAYERS ONLINE`
  - A large dynamic world population estimate.
  - Optional small Chinese label: `全球在线玩家估算`.

The online player count represents estimated total world population. It is not an exact live census. Use a credible public population baseline and a local growth-rate simulation to keep the number moving.

Recommended data strategy:

- Store a baseline value and timestamp in the app.
- Prefer public sources such as World Bank, UN, or Census data for the baseline.
- Animate the number locally with a small growth estimate.
- Keep source notes in documentation or code comments, not in visible UI.

## Entry Flow

The home screen supports double-click to enter.

Flow:

1. User double-clicks the home scene.
2. Camera begins satellite-focus zoom.
3. Title fades out.
4. Focus/scan visuals appear.
5. App checks local player profile.
6. If no profile exists, open initialization terminal.
7. If profile exists, open the daily system panel.

The entry flow must never end in a blank or stuck state.

Exit behavior:

- A small, restrained exit control appears on the system panel, such as a tiny `x` or orbit-return icon.
- `Esc` also returns to the home screen.
- Returning home restores readable title, population readout, and idle Earth rotation.

## Visual Direction After Entry

Use the "orbital terminal panel" direction.

After entry:

- Earth remains present but darker and less dominant.
- Satellite chains or orbital lines continue in the background.
- A system terminal panel appears in the foreground.
- The panel prioritizes daily tasks.
- The interface should be readable before it is decorative.
- Text stays cold, short, and system-like.

Avoid:

- A normal website dashboard.
- Excessive HUD clutter.
- Game lobby styling.
- Floating cards inside cards.

## First-run Initialization

On the first double-click entry, the app opens a 3-step initialization terminal.

The copy should feel like:

```text
PLAYER PROFILE INITIALIZATION
检测到旧存档
请导入当前进度
```

### Step 01: Player Profile

Fields:

- Nickname.
- Gender:
  - Male.
  - Female.
  - Non-binary.
  - Custom.
  - Prefer not to say.
- Personality/runtime tags.
- Custom tags.

MBTI is treated as one kind of tag, not the center of the system. Tags can include MBTI labels, runtime states, life routes, and interaction tendencies.

Example tags:

- INTP.
- INFJ.
- Observer.
- Night mode.
- Low-energy.
- Long-termist.
- Creator.
- Technical route.
- NPC filter.

### Step 02: Old Save Import

Fields:

- Age range.
- Education stage.
- Current life stage or identity.
- Stable skill count.
- Main skill area.
- Work/project count.
- Resource status.

Resource status is optional and skippable. If filled, use broad ranges only. Do not ask for exact income, assets, or savings.

The current main quest is optional. If provided, the system uses it to generate more personalized main-quest tasks.

The player can have only one current main quest. Everything else is treated as a side quest.

### Step 03: Status Calibration

Fields:

- Long-term persistence record.
- Setback recovery record.
- Life method or personal operating principle.
- Social energy state.
- Current runtime status.

Initial runtime statuses:

- Stable operation.
- High load.
- Low energy.
- Lost route.
- Maintenance mode.
- Main quest push.

### Initialization Output

After submission, calculate and display:

- Initial level.
- Level progress.
- Current status.
- Recommended current title.
- Initial achievements.
- Initial tags.
- System note.

Example:

```text
旧存档导入完成

Lv.27
称号：现实侧适应者
状态：中度高负载
已解锁成就：8

系统备注：
检测到持续运行痕迹。
建议保留主线任务，减少无收益支线。
```

## Level System

The level system is ironic and diagnostic. It is not a success score or life value judgment.

Level roughly represents old-save complexity and accumulated life progress. Status represents current runtime quality.

Examples:

```text
Lv.32
称号：稳定运行个体
状态：轻微异常
备注：长期处于高负载模式，建议降低 NPC 交互消耗。
```

```text
Lv.41
称号：资源积累者
状态：精神电量偏低
备注：资源充足，不代表生命值充足。
```

Default panel display:

- Show level.
- Show recommended title.
- Show runtime status.
- Show a level progress bar.

Expanded display:

- Current EXP.
- Required EXP for next level.
- Today's gained EXP.

## Daily Task System

The system panel is task-first.

Task count is dynamic:

- High load: 3 tasks.
- Low energy: 3 tasks.
- Maintenance mode: 3 tasks.
- Lost route: 4 tasks.
- Stable operation: 5 tasks.
- Main quest push: 5 tasks.

Task sources:

- Status-weighted tasks.
- Default system task pool.
- Optional custom task pool.
- Optional main-quest task if the player has set a main quest.

The first MVP includes these task categories:

- Main quest push.
- Body maintenance.
- Cognitive input.
- Creative output.
- Environment cleanup.
- NPC noise reduction.

Task copy uses cold system language.

Examples:

```text
每日任务已发布

01 主线维护
完成 25 分钟「地球 Online」推进
奖励：+35 EXP

02 身体维护
完成 15 分钟低强度运动
奖励：+20 EXP

03 NPC 过滤
跳过一次无收益争论
奖励：+18 EXP
```

### Completion and Expiry

Completing a task:

- Adds EXP.
- Updates level progress.
- May unlock an achievement.
- May unlock a title or tag through an achievement.
- Updates status signals.

Expired tasks:

- Do not subtract EXP.
- Do not reduce level.
- Do not punish the player.
- Are recorded and can influence future status inference.

Example expiry copy:

```text
任务已过期
状态记录已更新
未检测到惩罚事件
```

## Runtime Status System

Status is updated through both manual choice and automatic inference.

At daily entry, the player may confirm the current status. The system can adjust status based on recent task history.

Examples:

- Many expired tasks: low energy or high load tendency increases.
- Consistent main quest completion: stable operation or main quest push tendency increases.
- Repeated maintenance tasks: maintenance mode tendency increases.
- Repeated NPC noise reduction: NPC filter tendency increases.

Status affects task generation. It should not shame or punish the player.

## Achievements

Achievements are split into two types.

### Real-life Achievements

These are self-confirmed by the player during initialization or profile editing.

Examples:

- Completed an education stage.
- Built a stable skill.
- Completed a long project.
- Recovered from a major setback.
- Formed a reusable personal method.
- Built stable income or resources.

Real-life achievements can be edited after initialization, but the system records a save-correction log.

Example:

```text
存档修正记录
2026-06-21 20:24
玩家更新现实成就：长期项目 +1
系统重新计算旧存档复杂度
等级：Lv.23 -> Lv.24
称号推荐已更新
```

### System Runtime Achievements

These unlock automatically from local task and status records.

Examples:

- Complete tasks for 3 consecutive days.
- Complete 10 main quest tasks.
- Complete 3 NPC noise reduction tasks.
- Complete 7 body maintenance tasks.
- Recover after a period of expired tasks.

Achievement rarity is entertainment-only. It does not claim real statistics.

Example:

```text
成就解锁：拒绝无效消耗
稀有度：全服 8.4%
```

## Titles and Tags

There is no lottery. There are no random title drops.

Titles and tags come from:

- Initialization results.
- Self-confirmed real achievements.
- Automatically unlocked runtime achievements.
- Long-term task patterns.

The system recommends a current title, but the player can manually switch among unlocked titles.

The system recommends 3-5 displayed tags, but the player can fix, hide, or replace displayed tags.

The player may own many tags. The panel only shows 3-5 main tags by default.

## Removed From MVP

The MVP does not include:

- Coins.
- Lottery.
- Random reward drops.
- Shop.
- Inventory.
- Equipment.
- Social features.
- Cloud account.
- Backend database.

## Persistence

Use browser local storage for the MVP.

The app must support:

- Local save.
- Export JSON.
- Import JSON.

The exported JSON is human-readable and includes:

- Save format version.
- Export time.
- System note.
- Player profile.
- Level and EXP.
- Current status.
- Status history.
- Daily task history.
- Achievements.
- Titles.
- Tags.
- Real-life achievement self-assessments.
- Save-correction logs.
- Custom task pool.
- Main quest.
- Settings.

Example metadata:

```json
{
  "format": "earth-online-save-v1",
  "exportedAt": "2026-06-21T20:24:00+08:00",
  "systemNote": "旧存档仍在运行"
}
```

## Error Handling

The MVP must handle these cases:

- External population baseline cannot load: use bundled fallback baseline.
- Earth texture cannot load: show a fallback material and keep the app interactive.
- Double-click transition fails: return to home state.
- No profile exists: open initialization terminal.
- Save data is malformed: show import error and keep current local save unchanged.
- Export fails: show a concise system message.
- Task generation has too few tasks: fall back to default system tasks.

## Testing and Verification

Before claiming implementation is complete, verify:

- Home screen renders a visible Earth.
- Earth is bright enough to see land, ocean, clouds, and atmosphere.
- City lights or population lights are visible.
- Satellite-chain effect is visible and animated.
- Online player count renders and changes over time.
- Double-click enters the system flow.
- `Esc` and the exit control return to home.
- First-run initialization completes and saves data.
- Returning user skips initialization and sees the task panel.
- Daily tasks generate 3-5 tasks based on status.
- Completing a task adds EXP.
- Level progress updates.
- Achievements can unlock titles/tags.
- Exported JSON is readable and includes version metadata.
- Imported JSON restores the profile.

Use browser screenshots for desktop verification. If possible, verify mobile layout separately; if not possible in the current tool environment, state that limitation clearly.

## MVP Acceptance Criteria

The MVP is acceptable when:

- It no longer feels like a static webpage.
- The home screen communicates "Earth Online" immediately.
- Double-clicking never traps the user.
- A new user can initialize a profile in 3 steps.
- A returning user sees a task-first orbital terminal panel.
- Completing tasks changes EXP and progress.
- Titles, tags, and achievements feel earned, not random.
- Data survives reload through local storage.
- Data can be exported and imported as readable JSON.
