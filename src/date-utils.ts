const toIsoDateInJst = (date = new Date()) =>
  date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });

const parseIsoDateAsUtc = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  return new Date(Date.UTC(year, month - 1, day));
};

const formatIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const toYmd = (isoDate: string) => isoDate.replaceAll('-', '');

const fromYmd = (ymd: number | string) => {
  const value = String(ymd);
  if (!/^\d{8}$/.test(value)) {
    throw new Error(`Invalid yyyymmdd date: ${value}`);
  }
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
};

const addDays = (isoDate: string, days: number) => {
  const date = parseIsoDateAsUtc(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
};

const addMonthsClamped = (isoDate: string, months: number) => {
  const date = parseIsoDateAsUtc(isoDate);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDay));
  return formatIsoDate(date);
};

const buildWeekStartDates = (startDate: string, endDate: string) => {
  const dates: string[] = [];
  for (
    let current = startDate;
    current <= endDate;
    current = addDays(current, 7)
  ) {
    dates.push(current);
  }
  return dates;
};

const formatTime = (hhmm: number) => {
  const value = String(hhmm).padStart(4, '0');
  return `${value.slice(0, 2)}:${value.slice(2, 4)}`;
};

export {
  addDays,
  addMonthsClamped,
  buildWeekStartDates,
  formatTime,
  fromYmd,
  toIsoDateInJst,
  toYmd,
};
