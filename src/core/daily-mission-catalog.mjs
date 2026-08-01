import { DEFAULT_EFFECT_MINUTES } from "./player-runtime.mjs";

const ALL_STATUSES = Object.freeze([
  "stable_operation",
  "high_load",
  "low_energy",
  "lost_route",
  "main_quest_push",
]);

export const DAILY_MISSION_CATALOG = Object.freeze([
  mission("drink-water-250", "即刻饮用一杯清水，建议容量 250ml。", 3, "energy", 1, "hydrated", "滋润", "期间精力和专注小幅提升。", { focus: 1 }, "请勿长期忽略角色的基础补给需求。"),
  mission("walk-five", "离开座位步行 5 分钟。", 5, "vitality", 1, "warmed", "回暖", "期间体力和精力小幅提升。", { energy: 1 }, "短暂移动也能重新启动角色循环。"),
  mission("stretch-three", "完成 3 分钟肩颈与背部伸展。", 3, "vitality", 1, "unbound", "舒展", "期间体力小幅提升。", {}, "角色关节不应长期保持锁定状态。"),
  mission("open-window", "打开窗户或到户外呼吸新鲜空气 5 分钟。", 5, "vitality", 1, "ventilated", "通风", "期间体力和心境小幅提升。", { mood: 1 }, "环境交换有助于恢复角色响应。"),

  mission("eyes-distance", "离开屏幕，向远处看 3 分钟。", 3, "energy", 1, "buffered", "缓冲", "期间精力小幅提升。", {}, "请为视觉系统保留必要的空闲周期。"),
  mission("wash-face", "用清水洗脸，并暂时离开当前信息流。", 5, "energy", 1, "refreshed", "清醒", "期间精力和专注小幅提升。", { focus: 1 }, "短暂重启比持续过载更有效。"),
  mission("simple-food", "补充一份简单食物，不要边刷视频边进食。", 10, "energy", 2, "supplied", "补给", "期间精力小幅提升。", {}, "角色运行需要真实燃料。"),
  mission("quiet-ten", "关闭一个噪音来源，安静停留 10 分钟。", 10, "energy", 2, "silent", "静默", "期间精力和心境小幅提升。", { mood: 1 }, "减少输入也是一种系统维护。"),

  mission("focus-ten", "选择一件小事，连续专注 10 分钟。", 10, "focus", 2, "immersed", "沉浸", "期间专注小幅提升。", {}, "只推进一个进程，暂时忽略其余请求。"),
  mission("phone-away", "将手机放到够不到的位置 10 分钟。", 10, "focus", 2, "offline-focus", "离线专注", "期间专注和秩序小幅提升。", { order: 1 }, "物理距离可以降低无意识切换。"),
  mission("one-tab", "关闭无关页面，只保留当前需要的一个窗口。", 5, "focus", 1, "single-thread", "单线程", "期间专注小幅提升。", {}, "过多并发会降低角色处理效率。"),
  mission("write-next-step", "写下当前任务最小的下一步，并立刻开始。", 5, "focus", 1, "locked", "锁定", "期间专注和秩序小幅提升。", { order: 1 }, "可执行的下一步比完整计划更重要。"),

  mission("sunlight-five", "到有自然光的位置停留 5 分钟。", 5, "mood", 1, "sunlit", "采光", "期间心境和精力小幅提升。", { energy: 1 }, "角色不应长期停留在封闭地图。"),
  mission("music-one", "完整听完一首你真正喜欢的歌。", 5, "mood", 1, "resonance", "共振", "期间心境小幅提升。", {}, "允许无功利的愉悦进入当前进程。"),
  mission("name-feeling", "用一句话写下此刻最明显的感受。", 3, "mood", 1, "observed", "自检", "期间心境小幅提升。", {}, "被识别的情绪更容易被系统处理。"),
  mission("small-kindness", "为自己完成一件不超过 10 分钟的小事。", 10, "mood", 2, "softened", "缓和", "期间心境和体力小幅提升。", { vitality: 1 }, "角色同样属于需要被照顾的单位。"),

  mission("clear-one", "清理一个视线内最碍眼的物品。", 5, "order", 1, "organized", "整备", "期间秩序小幅提升。", {}, "先修复一个局部，不必整理整个世界。"),
  mission("delete-todo", "删除或归档一条已经失效的待办。", 3, "order", 1, "pruned", "修枝", "期间秩序小幅提升。", {}, "无效任务仍会占用后台资源。"),
  mission("prepare-tomorrow", "为明天提前准备一件会用到的物品。", 5, "order", 1, "prepared", "预载", "期间秩序和精力小幅提升。", { energy: 1 }, "提前加载可以减少下一次启动阻力。"),
  mission("desk-ten", "整理当前工作区域 10 分钟，到点即停。", 10, "order", 2, "aligned", "归位", "期间秩序小幅提升。", {}, "维护范围必须保持有限。"),

  mission("reply-one", "回复一条你一直拖延的重要消息。", 5, "connection", 1, "linked", "接通", "期间连接小幅提升。", {}, "长期搁置的通信会持续占用注意力。"),
  mission("thank-someone", "向一个具体的人表达一次真诚感谢。", 5, "connection", 1, "warm-link", "暖链", "期间连接和心境小幅提升。", { mood: 1 }, "有效连接需要真实信号。"),
  mission("check-in", "主动询问一位朋友最近过得怎么样。", 5, "connection", 1, "same-frequency", "同频", "期间连接小幅提升。", {}, "不要只在需要帮助时启动通信。"),
  mission("voice-ten", "与重要的人进行一次 10 分钟真实交流。", 10, "connection", 2, "open-channel", "开放频道", "期间连接和心境小幅提升。", { mood: 1 }, "高质量通信无法完全由表情包替代。"),

  mission("new-route", "走一条和平时不同的短路线。", 10, "exploration", 2, "map-open", "开图", "期间探索小幅提升。", {}, "未知区域不一定需要远行。"),
  mission("learn-one", "了解一个你从未认真理解的小知识。", 10, "exploration", 2, "scanning", "扫描", "期间探索和专注小幅提升。", { focus: 1 }, "保持好奇，但为本次探索设置边界。"),
  mission("notice-three", "观察周围，并记住三个此前忽略的细节。", 5, "exploration", 1, "wide-view", "广角", "期间探索小幅提升。", {}, "熟悉地图中仍存在未加载内容。"),
  mission("try-small", "尝试一种从未用过的小方法或小工具。", 10, "exploration", 2, "trial-mode", "试运行", "期间探索和秩序小幅提升。", { order: 1 }, "低成本试错是安全的地图扩展方式。"),
]);

export function getDailyMissionDefinition(id) {
  return DAILY_MISSION_CATALOG.find((item) => item.id === id) || null;
}

function mission(
  id,
  content,
  maxMinutes,
  primaryAttribute,
  primaryAmount,
  effectId,
  effectName,
  effectDescription,
  secondaryChanges,
  systemHint,
) {
  return Object.freeze({
    id,
    title: content,
    content,
    maxMinutes,
    statuses: ALL_STATUSES,
    systemHint,
    reward: Object.freeze({
      sourceId: `daily:${id}`,
      primaryAttribute,
      changes: Object.freeze({
        [primaryAttribute]: primaryAmount,
        ...secondaryChanges,
      }),
      effect: Object.freeze({
        id: effectId,
        name: effectName,
        description: effectDescription,
        durationMinutes: DEFAULT_EFFECT_MINUTES,
      }),
    }),
  });
}
