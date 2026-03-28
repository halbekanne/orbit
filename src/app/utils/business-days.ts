export function businessDaysSince(timestampMs: number, nowMs: number = Date.now()): number {
  const start = new Date(timestampMs);
  const end = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let count = 0;
  const current = new Date(start);
  while (current < end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}
