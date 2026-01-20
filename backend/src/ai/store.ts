import crypto from 'crypto';
import { getDatabase } from '../storage/database.js';

export type CategoryRecord = {
  id: string;
  userId: string;
  key: string;
  name: string;
  description?: string;
  examples?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TemplateRecord = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  prompt: string;
  isActive: boolean;
  confirmedCoverage: string[];
  aiCoverage: string[];
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
};

const omitUndefined = <T extends Record<string, unknown>>(data: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
};

const createId = (prefix: string): string => {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const defaultCategorySeed = () => [
  {
    key: 'todo',
    name: '待办',
    description: '需要执行的任务或提醒事项。',
    examples: ['报销本周差旅', '预约牙医复诊'],
    isActive: true,
  },
  {
    key: 'idea',
    name: '想法',
    description: '灵感、点子或待验证的思路。',
    examples: ['做个晨间仪式', '写一篇邮件自动化复盘'],
    isActive: true,
  },
  {
    key: 'expense',
    name: '支出',
    description: '费用记录或需要报销的开销。',
    examples: ['滴滴 38 元', '订阅工具 99 元/月'],
    isActive: true,
  },
  {
    key: 'schedule',
    name: '日程',
    description: '包含时间节点的安排或会议。',
    examples: ['周五 15:00 评审会', '下周二和李总对齐'],
    isActive: true,
  },
  {
    key: 'note',
    name: '笔记',
    description: '需要保留的记录、总结或片段。',
    examples: ['客户访谈要点', '发布流程 checklist'],
    isActive: true,
  },
  {
    key: 'bookmark',
    name: '书签',
    description: '需要稍后阅读或保存的链接。',
    examples: ['https://example.com', '新模型评测文章'],
    isActive: true,
  },
  {
    key: 'unknown',
    name: '未知',
    description: '无法明确归类的内容。',
    examples: ['...', '待定内容'],
    isActive: false,
  },
];

const defaultTemplateSeed = (coverageKeys: string[]) => ({
  name: '默认分类提示词 v1',
  description: '基础分类提示词，覆盖当前启用的分类。',
  prompt:
    '你是分类引擎，请从以下分类中选择最合适的一类：待办、想法、支出、日程、笔记、书签。输出结构化结果并给出理由。',
  confirmedCoverage: coverageKeys,
  aiCoverage: coverageKeys,
});

const ensureUserCategories = (userId: string): void => {
  const db = getDatabase();
  const existing = db.listAiCategories(userId) as CategoryRecord[];
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  const seeded = defaultCategorySeed().map((item) => ({
    id: createId('cat'),
    userId,
    key: item.key,
    name: item.name,
    description: item.description,
    examples: item.examples,
    isActive: item.isActive,
    createdAt: now,
    updatedAt: now,
  }));

  seeded.forEach((record) => {
    db.createAiCategory(record);
  });
};

const ensureUserTemplates = (userId: string): void => {
  const db = getDatabase();
  const existing = db.listAiTemplates(userId) as TemplateRecord[];
  if (existing.length > 0) return;

  ensureUserCategories(userId);
  const categories = db.listAiCategories(userId) as CategoryRecord[];
  const coverageKeys = categories.filter((item) => item.isActive).map((item) => item.key);
  const seed = defaultTemplateSeed(coverageKeys);
  const now = new Date().toISOString();

  db.createAiTemplate({
    id: createId('tmpl'),
    userId,
    name: seed.name,
    description: seed.description,
    prompt: seed.prompt,
    isActive: true,
    confirmedCoverage: seed.confirmedCoverage,
    aiCoverage: seed.aiCoverage,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  });
};

export const listCategories = (userId: string): CategoryRecord[] => {
  ensureUserCategories(userId);
  const db = getDatabase();
  return db.listAiCategories(userId) as CategoryRecord[];
};

export const createCategory = (
  userId: string,
  data: Omit<CategoryRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): CategoryRecord => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const record: CategoryRecord = {
    ...data,
    id: createId('cat'),
    userId,
    createdAt: now,
    updatedAt: now,
  };
  return db.createAiCategory(record) as CategoryRecord;
};

export const updateCategory = (
  userId: string,
  id: string,
  data: Partial<Omit<CategoryRecord, 'id' | 'userId' | 'createdAt'>>
): CategoryRecord | null => {
  const patch = omitUndefined(data);
  const db = getDatabase();
  return db.updateAiCategory(userId, id, patch) as CategoryRecord | null;
};

export const listTemplates = (userId: string): TemplateRecord[] => {
  ensureUserTemplates(userId);
  const db = getDatabase();
  return db.listAiTemplates(userId) as TemplateRecord[];
};

export const createTemplate = (
  userId: string,
  data: Omit<TemplateRecord, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isActive'>
): TemplateRecord => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const record: TemplateRecord = {
    ...data,
    id: createId('tmpl'),
    userId,
    isActive: false,
    confirmedCoverage: data.confirmedCoverage ?? [],
    aiCoverage: data.aiCoverage ?? [],
    createdAt: now,
    updatedAt: now,
    confirmedAt: data.confirmedAt ?? (data.confirmedCoverage?.length ? now : undefined),
  };
  return db.createAiTemplate(record) as TemplateRecord;
};

export const updateTemplate = (
  userId: string,
  id: string,
  data: Partial<Omit<TemplateRecord, 'id' | 'userId' | 'createdAt' | 'isActive'>>
): TemplateRecord | null => {
  const now = new Date().toISOString();
  const patch = omitUndefined(data) as Partial<TemplateRecord>;
  if (Array.isArray(data.confirmedCoverage)) {
    patch.confirmedAt = data.confirmedCoverage.length ? now : undefined;
  }
  const db = getDatabase();
  return db.updateAiTemplate(userId, id, patch) as TemplateRecord | null;
};

export const activateTemplate = (userId: string, id: string): TemplateRecord | null => {
  const db = getDatabase();
  return db.activateAiTemplate(userId, id) as TemplateRecord | null;
};

export const getTemplateById = (
  userId: string,
  id: string
): TemplateRecord | null => {
  const db = getDatabase();
  return db.getAiTemplateById(userId, id) as TemplateRecord | null;
};
