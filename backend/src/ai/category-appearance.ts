const CATEGORY_COLOR_PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#0f766e',
  '#ea580c',
  '#db2777',
  '#0891b2',
  '#4f46e5',
  '#ca8a04',
  '#16a34a',
  '#dc2626',
  '#9333ea',
  '#0284c7',
];

const UNKNOWN_CATEGORY_KEY = 'unknown';
const UNKNOWN_CATEGORY_COLOR = '#6b7280';

const CATEGORY_ICON_SET = new Set([
  'inbox',
  'check-square',
  'lightbulb',
  'wallet',
  'calendar-clock',
  'notebook',
  'bookmark',
  'help-circle',
  'film',
  'book-open',
  'wrench',
  'briefcase',
  'graduation-cap',
  'heart-pulse',
  'shopping-cart',
  'receipt',
  'target',
  'plane',
  'code',
  'star',
]);

const DEFAULT_ICON_BY_KEY: Record<string, string> = {
  todo: 'check-square',
  idea: 'lightbulb',
  expense: 'wallet',
  schedule: 'calendar-clock',
  note: 'notebook',
  bookmark: 'bookmark',
  unknown: 'help-circle',
  movie: 'film',
  books: 'book-open',
  sinbox: 'wrench',
};

const hashString = (input: string): number => {
  let hash = 0;
  const source = input || 'unknown';
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 33 + source.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const normalizeKey = (key?: string): string => {
  return String(key ?? '').trim().toLowerCase() || UNKNOWN_CATEGORY_KEY;
};

const isHexColor = (value: string): boolean => {
  return /^#[0-9a-fA-F]{6}$/.test(value);
};

export const getAutoCategoryColor = (key?: string): string => {
  const normalizedKey = normalizeKey(key);

  if (normalizedKey === UNKNOWN_CATEGORY_KEY) {
    return UNKNOWN_CATEGORY_COLOR;
  }

  const index = hashString(normalizedKey) % CATEGORY_COLOR_PALETTE.length;
  return CATEGORY_COLOR_PALETTE[index];
};

export const resolveCategoryIcon = (key?: string, icon?: string): string => {
  const normalizedKey = normalizeKey(key);
  const normalizedIcon = String(icon ?? '').trim();

  if (normalizedIcon && CATEGORY_ICON_SET.has(normalizedIcon)) {
    return normalizedIcon;
  }

  return DEFAULT_ICON_BY_KEY[normalizedKey] || 'inbox';
};

export const resolveCategoryColor = (key?: string, color?: string): string => {
  const normalizedKey = normalizeKey(key);

  if (normalizedKey === UNKNOWN_CATEGORY_KEY) {
    return UNKNOWN_CATEGORY_COLOR;
  }

  const normalizedColor = String(color ?? '').trim();
  if (normalizedColor && isHexColor(normalizedColor)) {
    return normalizedColor.toLowerCase();
  }

  return getAutoCategoryColor(normalizedKey);
};
