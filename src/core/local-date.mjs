export function getLocalDateKey(value = new Date()) {
  const date = normalizeDate(value);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getLocalWeekRange(value = new Date()) {
  const date = normalizeDate(value);
  const day = date.getDay() || 7;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  start.setDate(start.getDate() - day + 1);

  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);

  return {
    key: getLocalDateKey(start),
    start: getLocalDateKey(start),
    end: getLocalDateKey(end),
  };
}

function normalizeDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Invalid calendar date");
  }

  return date;
}
