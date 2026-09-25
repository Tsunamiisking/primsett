/** All dates stored UTC. Display in Africa/Lagos (UTC+1). */

const LAGOS_TZ = 'Africa/Lagos';

export function toLagosTime(utcDate: Date): Date {
  const lagosStr = utcDate.toLocaleString('en-US', { timeZone: LAGOS_TZ });
  return new Date(lagosStr);
}

export function formatLagosDate(utcDate: Date): string {
  return utcDate.toLocaleDateString('en-NG', {
    timeZone: LAGOS_TZ,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatLagosTime(utcDate: Date): string {
  return utcDate.toLocaleTimeString('en-NG', {
    timeZone: LAGOS_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatLagosDateTime(utcDate: Date): string {
  return `${formatLagosDate(utcDate)} at ${formatLagosTime(utcDate)}`;
}

/** Parse a date string (YYYY-MM-DD) and time string (HH:MM) in Lagos timezone. */
export function lagosDateTimeToUTC(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  // Build a date string with Lagos offset (+01:00)
  const lagosStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+01:00`;
  return new Date(lagosStr);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 3_600_000);
}

/** Number of hours between two dates (positive if b > a). */
export function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 3_600_000;
}
