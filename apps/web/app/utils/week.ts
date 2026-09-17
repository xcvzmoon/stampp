export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function mondayForDate(date: string): string {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return addCalendarDays(date, -(day === 0 ? 6 : day - 1));
}

export function calendarDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  let year = '';
  let month = '';
  let day = '';
  for (const part of parts) {
    if (part.type === 'year') year = part.value;
    if (part.type === 'month') month = part.value;
    if (part.type === 'day') day = part.value;
  }
  return `${year}-${month}-${day}`;
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}:${String(remainder).padStart(2, '0')}`;
}

export function parseDuration(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(trimmed);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (!/^\d{1,3}(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const hours = Number(trimmed);
  if (!Number.isFinite(hours)) return null;
  return Math.round(hours * 60);
}
