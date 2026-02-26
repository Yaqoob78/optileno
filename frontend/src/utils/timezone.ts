const DAY_NAME_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getParts(dateValue: Date, timeZone: string, withWeekday = false): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: withWeekday ? 'short' : undefined,
  });

  const parts = formatter.formatToParts(dateValue);
  const result: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      // Fix for some browsers returning "24" instead of "00" for midnight in h24/h23
      if (part.type === 'hour' && part.value === '24') {
        result[part.type] = '00';
      } else {
        result[part.type] = part.value;
      }
    }
  }

  return result;
}

export function getDateKeyInTimezone(dateValue: Date, timeZone: string): string {
  const parts = getParts(dateValue, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getTimeHHMMInTimezone(dateValue: Date, timeZone: string): string {
  const parts = getParts(dateValue, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

export function getWeekdayIndexInTimezone(dateValue: Date, timeZone: string): number {
  const parts = getParts(dateValue, timeZone, true);
  return DAY_NAME_TO_INDEX[parts.weekday] ?? dateValue.getDay();
}

export function isSameDayInTimezone(a: Date, b: Date, timeZone: string): boolean {
  return getDateKeyInTimezone(a, timeZone) === getDateKeyInTimezone(b, timeZone);
}

export function getNextLocalDateForWeekday(
  timeZone: string,
  targetDay: number,
  fromDate: Date = new Date(),
): string {
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(fromDate.getTime() + offset * 24 * 60 * 60 * 1000);
    if (getWeekdayIndexInTimezone(candidate, timeZone) === targetDay) {
      return getDateKeyInTimezone(candidate, timeZone);
    }
  }
  return getDateKeyInTimezone(fromDate, timeZone);
}

export function formatLocalDateLabel(localDateYmd: string, timeZone: string): string {
  const [year, month, day] = localDateYmd.split("-").map(Number);
  const dateForDisplay = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(dateForDisplay);
}

export function addDaysToLocalDateKey(localDateYmd: string, days: number): string {
  const [year, month, day] = localDateYmd.split("-").map(Number);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return localDateYmd;
  }

  const cursor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  cursor.setUTCDate(cursor.getUTCDate() + days);

  const yyyy = cursor.getUTCFullYear();
  const mm = String(cursor.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(cursor.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
