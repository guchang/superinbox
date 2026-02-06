const UNKNOWN_CATEGORY_KEY = 'unknown';

export type RuntimePromptCategoryRule = {
  key: string;
  name: string;
  description: string;
  examples: string[];
};

export type RuntimePromptContext = {
  nowIso: string;
  timezone: string;
  contentType: string;
  content: string;
  activeCategoryKeys: string[];
  fallbackCategoryKey: 'unknown';
  categoryRules: RuntimePromptCategoryRule[];
};

const DEFAULT_UNKNOWN_RULE: RuntimePromptCategoryRule = {
  key: UNKNOWN_CATEGORY_KEY,
  name: UNKNOWN_CATEGORY_KEY,
  description: 'System fallback category when no other category can be matched.',
  examples: ['...', 'TBD'],
};

const replaceAll = (source: string, token: string, value: string): string => {
  return source.split(token).join(value);
};

const normalizeText = (value: unknown, fallback = ''): string => {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeExamples = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 8);
};

type RuntimeCategoryInput = {
  key?: string;
  name?: string;
  description?: string;
  examples?: string[];
  isActive?: boolean;
};

export const buildRuntimeCategoryConfig = (
  categories?: RuntimeCategoryInput[]
): {
  activeCategoryKeys: string[];
  fallbackCategoryKey: 'unknown';
  categoryRules: RuntimePromptCategoryRule[];
} => {
  const source = Array.isArray(categories) ? categories : [];
  const categoryRules: RuntimePromptCategoryRule[] = [];
  const seen = new Set<string>();

  for (const category of source) {
    const key = normalizeText(category?.key).toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }

    const isUnknown = key === UNKNOWN_CATEGORY_KEY;
    if (category?.isActive === false && !isUnknown) {
      continue;
    }

    seen.add(key);
    const name = normalizeText(category?.name, key);
    const description = normalizeText(category?.description);

    categoryRules.push({
      key,
      name,
      description: description || (isUnknown ? DEFAULT_UNKNOWN_RULE.description : name),
      examples: normalizeExamples(category?.examples),
    });
  }

  if (!seen.has(UNKNOWN_CATEGORY_KEY)) {
    categoryRules.push({ ...DEFAULT_UNKNOWN_RULE });
  }

  if (categoryRules.length === 0) {
    categoryRules.push({ ...DEFAULT_UNKNOWN_RULE });
  }

  return {
    activeCategoryKeys: categoryRules.map((item) => item.key),
    fallbackCategoryKey: UNKNOWN_CATEGORY_KEY,
    categoryRules,
  };
};

export const renderPromptWithRuntime = (
  basePrompt: string,
  context: RuntimePromptContext
): string => {
  const template = normalizeText(basePrompt);
  if (!template) {
    return template;
  }

  const activeKeysJson = JSON.stringify(context.activeCategoryKeys);
  const categoryRulesJson = JSON.stringify(context.categoryRules, null, 2);

  let rendered = template;
  rendered = replaceAll(rendered, '{{NOW_ISO}}', context.nowIso);
  rendered = replaceAll(rendered, '{{TIMEZONE}}', context.timezone);
  rendered = replaceAll(rendered, '{{CONTENT_TYPE}}', context.contentType);
  rendered = replaceAll(rendered, '{{CONTENT}}', context.content);
  rendered = replaceAll(rendered, '{{ACTIVE_CATEGORY_KEYS_JSON}}', activeKeysJson);
  rendered = replaceAll(rendered, '{{CATEGORY_RULES_JSON}}', categoryRulesJson);
  rendered = replaceAll(rendered, '{{FALLBACK_CATEGORY_KEY}}', context.fallbackCategoryKey);

  const hasRuntimePlaceholders =
    template.includes('{{ACTIVE_CATEGORY_KEYS_JSON}}') ||
    template.includes('{{CATEGORY_RULES_JSON}}') ||
    template.includes('{{FALLBACK_CATEGORY_KEY}}');

  const hasRuntimeConfigSection =
    /activeCategoryKeys/i.test(rendered) && /categoryRules/i.test(rendered);

  if (!hasRuntimePlaceholders && !hasRuntimeConfigSection) {
    rendered = `${rendered}\n\n[Runtime Category Config]\n- activeCategoryKeys: ${activeKeysJson}\n- fallbackCategoryKey: \"${context.fallbackCategoryKey}\"\n- categoryRules: ${categoryRulesJson}`;
  }

  return rendered;
};
