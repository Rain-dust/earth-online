import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createCompactLocationIndex } from "../src/core/location-index.mjs";

const POPULATION_THRESHOLD = 100_000;
const COUNTRY_TOP_LIMIT = 8;

const COUNTRY_DISPLAY_OVERRIDES = Object.freeze({
  CN: "中国",
  HK: "中国香港",
  MO: "中国澳门",
  TW: "中国台湾",
});

const CN_REGION_NAMES = Object.freeze({
  Anhui: "安徽", Beijing: "北京", Chongqing: "重庆", Fujian: "福建", Gansu: "甘肃",
  Guangdong: "广东", Guangxi: "广西", Guizhou: "贵州", Hainan: "海南", Hebei: "河北",
  Heilongjiang: "黑龙江", Henan: "河南", Hubei: "湖北", Hunan: "湖南", Jiangsu: "江苏",
  Jiangxi: "江西", Jilin: "吉林", Liaoning: "辽宁", "Inner Mongolia": "内蒙古",
  Ningxia: "宁夏", Qinghai: "青海", Shaanxi: "陕西", Shandong: "山东", Shanghai: "上海",
  Shanxi: "山西", Sichuan: "四川", Tianjin: "天津", Tibet: "西藏", Xinjiang: "新疆",
  Yunnan: "云南", Zhejiang: "浙江",
});

const CN_CITY_NAMES = Object.freeze({
  Beijing: "北京", Shanghai: "上海", Shenzhen: "深圳", Guangzhou: "广州", Chongqing: "重庆",
  Tianjin: "天津", Chengdu: "成都", Wuhan: "武汉", Hangzhou: "杭州", Nanjing: "南京",
  Xian: "西安", "Xi'an": "西安", Suzhou: "苏州", Zhengzhou: "郑州", Changsha: "长沙",
  Qingdao: "青岛", Shenyang: "沈阳", Ningbo: "宁波", Dongguan: "东莞", Foshan: "佛山",
  Xiamen: "厦门", Kunming: "昆明", Harbin: "哈尔滨", Jinan: "济南", Hefei: "合肥",
  Fuzhou: "福州", Dalian: "大连", Nanning: "南宁", Guiyang: "贵阳", Taiyuan: "太原",
});

export function selectLocationSourceRecords(records) {
  const valid = (Array.isArray(records) ? records : []).filter(isValidSourceRecord);
  const topIds = new Set();
  const countries = new Map();

  for (const record of valid) {
    const code = normalizeCountryCode(record.iso2);
    if (!countries.has(code)) countries.set(code, []);
    countries.get(code).push(record);
  }

  for (const countryRecords of countries.values()) {
    countryRecords
      .slice()
      .sort(compareSourceImportance)
      .slice(0, COUNTRY_TOP_LIMIT)
      .forEach((record) => topIds.add(String(record.id)));
  }

  return valid.filter((record) => (
    getPopulation(record) >= POPULATION_THRESHOLD
    || ["primary", "admin"].includes(record.capital)
    || topIds.has(String(record.id))
  ));
}

export function buildLocationRecords(records, { displayNames = true } = {}) {
  const countryNames = displayNames ? createCountryDisplayNames() : null;
  const unique = new Map();

  for (const record of selectLocationSourceRecords(records)) {
    const location = toLocationRecord(record, countryNames);
    if (!unique.has(location.id)) unique.set(location.id, location);
  }

  return [...unique.values()].sort(compareLocations);
}

export async function buildLocationIndex({ sourcePath, outputPath }) {
  if (!sourcePath || !outputPath) throw new Error("sourcePath and outputPath are required");
  const records = await readSourceRecords(sourcePath);
  const locations = buildLocationRecords(records);
  const payload = `${JSON.stringify(createCompactLocationIndex(locations))}\n`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, payload, "utf8");
  return { count: locations.length, bytes: Buffer.byteLength(payload), outputPath };
}

async function readSourceRecords(sourcePath) {
  const text = await readFile(sourcePath, "utf8");
  if (extname(sourcePath).toLowerCase() === ".json") {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : parsed.cities;
  }
  return parseCsv(text);
}

function toLocationRecord(record, countryDisplayNames) {
  const countryCode = normalizeCountryCode(record.iso2);
  const countryName = String(record.country || countryCode).trim();
  const regionName = optionalText(record.admin_name);
  const cityName = String(record.city || record.city_ascii).trim();
  const asciiName = String(record.city_ascii || cityName).trim();
  const isChina = countryCode === "CN";

  return {
    id: `simplemaps:${String(record.id).trim()}`,
    countryCode,
    countryName,
    countryDisplayName: COUNTRY_DISPLAY_OVERRIDES[countryCode]
      || countryDisplayNames?.of(countryCode)
      || countryName,
    regionCode: optionalText(record.admin_code),
    regionName,
    regionDisplayName: isChina && regionName ? CN_REGION_NAMES[regionName] || regionName : regionName,
    cityName,
    cityDisplayName: isChina ? CN_CITY_NAMES[cityName] || CN_CITY_NAMES[asciiName] || cityName : cityName,
    asciiName,
    latitude: Number(record.lat),
    longitude: Number(record.lng),
    population: getPopulation(record),
    capitalType: ["primary", "admin"].includes(record.capital) ? record.capital : null,
  };
}

function compareSourceImportance(a, b) {
  return capitalRank(a.capital) - capitalRank(b.capital)
    || getPopulation(b) - getPopulation(a)
    || String(a.id).localeCompare(String(b.id), "en");
}

function compareLocations(a, b) {
  return a.countryCode.localeCompare(b.countryCode, "en")
    || String(a.regionName || "").localeCompare(String(b.regionName || ""), "en")
    || a.cityName.localeCompare(b.cityName, "en")
    || a.id.localeCompare(b.id, "en");
}

function isValidSourceRecord(record) {
  const latitude = Number(record?.lat);
  const longitude = Number(record?.lng);
  return Boolean(record)
    && String(record.id || "").trim() !== ""
    && /^[A-Za-z]{2}$/.test(String(record.iso2 || "").trim())
    && String(record.city || record.city_ascii || "").trim() !== ""
    && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function getPopulation(record) {
  const population = Number(record?.population);
  return Number.isFinite(population) && population >= 0 ? Math.round(population) : 0;
}

function normalizeCountryCode(value) {
  return String(value || "").trim().toUpperCase();
}

function optionalText(value) {
  const text = String(value || "").trim();
  return text || null;
}

function capitalRank(value) {
  if (value === "primary") return 0;
  if (value === "admin") return 1;
  return 2;
}

function createCountryDisplayNames() {
  try {
    return new Intl.DisplayNames(["zh-CN"], { type: "region" });
  } catch {
    return null;
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift()?.map((header) => header.trim()) || [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const sourcePath = getArgument("--source");
  const outputPath = getArgument("--output")
    || resolve("assets/data/earth-online-locations.v1.json");
  buildLocationIndex({ sourcePath: resolve(sourcePath || ""), outputPath: resolve(outputPath) })
    .then(({ count, bytes, outputPath: destination }) => {
      process.stdout.write(`Generated ${count} locations (${bytes} bytes) at ${destination}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}

function getArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}
