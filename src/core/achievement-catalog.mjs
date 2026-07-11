export const ACHIEVEMENT_CATALOG_VERSION = 2;

export const ACHIEVEMENT_CATALOG = Object.freeze([
  define(
    "academic-complete",
    "学有所成",
    "完成高等教育副本，取得一份正式毕业记录。",
    "learning",
    38,
    ["education_undergraduate", "education_graduate"],
  ),
  define(
    "driver-license-hunter",
    "驾照猎人",
    "通过驾考专属副本，解锁机动车驾驶权限。",
    "exploration",
    53,
  ),
  define(
    "cooking-awakened",
    "厨艺觉醒",
    "不依赖外卖，独立完成一桌家常菜。",
    "skills",
    62,
  ),
  define(
    "first-love",
    "初恋支线",
    "触发人生第一次真切心动的关系剧情。",
    "relationships",
    71,
  ),
  define(
    "first-job",
    "第一份工",
    "首次接入职业主线，获得一份正式工作记录。",
    "career",
    71,
    ["stage_working", "stage_freelancing"],
  ),
  define(
    "overseas-checkin",
    "海外打卡",
    "完成一次跨服旅行，留下境外地图记录。",
    "exploration",
    11,
  ),
  define(
    "true-bond",
    "真心羁绊",
    "拥有一段经历时间验证、可以彼此信任的友情。",
    "relationships",
    13,
  ),
  define(
    "self-rescue",
    "自我救赎",
    "在低谷期完成自我调节，重新恢复运行。",
    "growth",
    67,
    ["setback_recovered", "setback_repeated_recovery"],
  ),
  define(
    "keep-passion",
    "守住热爱",
    "让一件真正喜欢的事穿过时间，仍然留在生活里。",
    "skills",
    13,
  ),
  define(
    "wilderness-camp",
    "山野露营",
    "在城市边界之外完成一次户外过夜。",
    "exploration",
    10.3,
  ),
  define(
    "financial-freedom",
    "财富自由",
    "资源储备足以让生存不再占据全部主线。",
    "resources",
    5.2,
  ),
  define(
    "paid-home",
    "全款置业",
    "在没有住房贷款的情况下取得一处房产。",
    "resources",
    4,
  ),
]);

export function getAchievementDefinition(id) {
  return ACHIEVEMENT_CATALOG.find((definition) => definition.id === id) || null;
}

export function getRarityTier(percent) {
  const value = Number(percent);

  if (value < 1) return { id: "world_record", label: "世界级记录" };
  if (value < 5) return { id: "ultra_rare", label: "极稀有记录" };
  if (value < 20) return { id: "rare", label: "稀有记录" };
  if (value < 50) return { id: "precious", label: "珍贵记录" };
  return { id: "common", label: "常见记录" };
}

function define(id, title, description, category, rarityPercent, oldSaveSignals = []) {
  return Object.freeze({
    id,
    title,
    description,
    category,
    rarityPercent,
    iconAsset: `./assets/achievements/${id}.png`,
    oldSaveSignals: Object.freeze(oldSaveSignals),
  });
}
