import test from "node:test";
import assert from "node:assert/strict";
import {
  createLocationSelectorState,
  getLocationSelectorMarkup,
  reduceLocationSelectorState,
} from "../../src/ui/location-selector.mjs";

const LOCATIONS = [
  location("cn-shenzhen", "CN", "China", "中国", "Guangdong", "广东", "Shenzhen", "深圳", 17_600_000),
  location("cn-foshan", "CN", "China", "中国", "Guangdong", "广东", "Foshan", "佛山", 9_500_000),
  location("us-springfield-il", "US", "United States", "美国", "Illinois", "Illinois", "Springfield", "Springfield", 114_000),
  location("us-springfield-mo", "US", "United States", "美国", "Missouri", "Missouri", "Springfield", "Springfield", 170_000),
];

test("selector starts as one global city search without drill-down or skip", () => {
  const markup = getLocationSelectorMarkup(createLocationSelectorState(), LOCATIONS);

  assert.match(markup, /搜索你选择的城市/);
  assert.match(markup, /全球城市搜索/);
  assert.match(markup, /name="locationQuery"/);
  assert.doesNotMatch(markup, /选择国家|选择省|暂不建立|data-location-action="skip"/);
  assert.doesNotMatch(markup, /<select\b|panel|card/i);
});

test("global city search returns at most three contextualized results", () => {
  const state = reduceLocationSelectorState(
    createLocationSelectorState(),
    { type: "query", value: "spring" },
    LOCATIONS,
  );
  const markup = getLocationSelectorMarkup(state, LOCATIONS);

  assert.match(markup, /美国 · Missouri · Springfield/);
  assert.match(markup, /美国 · Illinois · Springfield/);
  assert.ok((markup.match(/data-location-result/g) || []).length <= 3);
});

test("selection requires the approved explicit confirmation", () => {
  let state = reduceLocationSelectorState(
    createLocationSelectorState(),
    { type: "query", value: "深圳" },
    LOCATIONS,
  );
  state = reduceLocationSelectorState(
    state,
    { type: "select_city", value: "cn-shenzhen" },
    LOCATIONS,
  );

  const markup = getLocationSelectorMarkup(state, LOCATIONS);
  assert.equal(state.phase, "confirm");
  assert.match(markup, /你选择：中国 · 广东 · 深圳/);
  assert.match(markup, /在这里建立城市锚点/);
  assert.match(markup, /data-location-action="confirm"/);
  assert.doesNotMatch(markup, /检测|定位到|自动选择/);
});

test("loading and errors remain truthful and always allow exit", () => {
  const loading = getLocationSelectorMarkup({
    ...createLocationSelectorState(),
    status: "loading",
  }, []);
  const failed = getLocationSelectorMarkup({
    ...createLocationSelectorState(),
    status: "error",
    error: "文件损坏",
  }, []);

  assert.match(loading, /正在读取本地点位索引/);
  assert.match(loading, /data-location-action="exit"/);
  assert.match(failed, /文件损坏/);
  assert.match(failed, /data-location-action="retry"/);
  assert.match(failed, /data-location-action="exit"/);
});

test("empty search results never fabricate a city", () => {
  const markup = getLocationSelectorMarkup({
    ...createLocationSelectorState(),
    query: "不存在",
  }, LOCATIONS);

  assert.match(markup, /没有找到匹配城市/);
  assert.doesNotMatch(markup, /data-location-action="confirm"/);
});

function location(id, countryCode, countryName, countryDisplayName, regionName, regionDisplayName, cityName, cityDisplayName, population) {
  return {
    id,
    countryCode,
    countryName,
    countryDisplayName,
    regionCode: null,
    regionName,
    regionDisplayName,
    cityName,
    cityDisplayName,
    asciiName: cityName,
    latitude: 1,
    longitude: 1,
    population,
    capitalType: null,
  };
}
