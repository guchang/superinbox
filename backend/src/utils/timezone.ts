export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const formatOffset = (offsetMinutes: number): string => {
  if (offsetMinutes === 0) {
    return 'Z';
  }

  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
  const minutes = String(absMinutes % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
};

export const formatDateInTimeZone = (date: Date, timeZone: string): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });

    const parts = formatter.formatToParts(date);
    const values: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== 'literal') {
        values[part.type] = part.value;
      }
    }

    const year = values.year;
    const month = values.month;
    const day = values.day;
    const hour = values.hour;
    const minute = values.minute;
    const second = values.second;

    if (!year || !month || !day || !hour || !minute || !second) {
      return date.toISOString();
    }

    const localIso = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    const localAsUtc = new Date(localIso);
    const offsetMinutes = Math.round((localAsUtc.getTime() - date.getTime()) / 60000);
    const offset = formatOffset(offsetMinutes);

    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.${milliseconds}${offset}`;
  } catch {
    return date.toISOString();
  }
};
