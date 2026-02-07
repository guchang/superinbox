export type CategoryLibraryCategory = {
  key: string
  name: string
  description: string
  examples: string[]
  icon?: string
  color?: string
}

export type CategoryLibraryScenario = {
  id: string
  nameKey: string
  descriptionKey: string
  categories: CategoryLibraryCategory[]
}

export const CATEGORY_LIBRARY_SCENARIOS: CategoryLibraryScenario[] = [
  {
    id: 'personal_capture',
    nameKey: 'library.scenarios.personalCapture.name',
    descriptionKey: 'library.scenarios.personalCapture.description',
    categories: [
      {
        key: 'todo',
        name: '待办',
        description: '需要执行的任务或提醒事项。',
        examples: ['报销本周差旅', '预约牙医复诊'],
        icon: 'check-square',
        color: '#2563eb',
      },
      {
        key: 'idea',
        name: '想法',
        description: '灵感、点子或待验证的思路。',
        examples: ['做个晨间仪式', '写一篇邮件自动化复盘'],
        icon: 'lightbulb',
        color: '#f59e0b',
      },
      {
        key: 'schedule',
        name: '日程',
        description: '包含时间节点的安排或会议。',
        examples: ['周五 15:00 评审会', '下周二和李总对齐'],
        icon: 'calendar-clock',
        color: '#7c3aed',
      },
      {
        key: 'note',
        name: '笔记',
        description: '需要保留的记录、总结或片段。',
        examples: ['客户访谈要点', '发布流程 checklist'],
        icon: 'notebook',
        color: '#0f766e',
      },
      {
        key: 'bookmark',
        name: '书签',
        description: '需要稍后阅读或保存的链接。',
        examples: ['https://example.com', '新模型评测文章'],
        icon: 'bookmark',
        color: '#9333ea',
      },
      {
        key: 'expense',
        name: '财务',
        description: '费用记录或需要报销的开销。',
        examples: ['滴滴 38 元', '订阅工具 99 元/月'],
        icon: 'wallet',
        color: '#db2777',
      },
    ],
  },
  {
    id: 'media_reading',
    nameKey: 'library.scenarios.mediaReading.name',
    descriptionKey: 'library.scenarios.mediaReading.description',
    categories: [
      {
        key: 'movie',
        name: '影视',
        description: '电视剧、综艺、电影、动漫等影视作品及观后感。',
        examples: ['钢铁侠', '忙忙碌碌寻宝藏', '葬送的芙莉莲'],
        icon: 'film',
        color: '#16a34a',
      },
      {
        key: 'books',
        name: '书籍',
        description: '书籍、阅读计划与读后感。',
        examples: ['基督山伯爵', '长安的荔枝读后感'],
        icon: 'book-open',
        color: '#6d28d9',
      },
      {
        key: 'watchlist',
        name: '待看清单',
        description: '想看的影视或想读的内容清单。',
        examples: ['今年要补完诺兰电影', '加入 3 本新书'],
        icon: 'star',
        color: '#0891b2',
      },
      {
        key: 'review_log',
        name: '观后感',
        description: '记录观影或阅读后的观点和反思。',
        examples: ['《沙丘2》观后感', '这本书的 3 个收获'],
        icon: 'graduation-cap',
        color: '#c2410c',
      },
    ],
  },
  {
    id: 'work_project',
    nameKey: 'library.scenarios.workProject.name',
    descriptionKey: 'library.scenarios.workProject.description',
    categories: [
      {
        key: 'meeting_minutes',
        name: '会议纪要',
        description: '会议记录、结论和跟进事项。',
        examples: ['周会纪要', '评审会结论与负责人'],
        icon: 'briefcase',
        color: '#0369a1',
      },
      {
        key: 'project_plan',
        name: '项目计划',
        description: '里程碑、任务拆解和排期安排。',
        examples: ['Q2 项目排期', '版本里程碑计划'],
        icon: 'target',
        color: '#4f46e5',
      },
      {
        key: 'decision_log',
        name: '决策记录',
        description: '方案选择依据和关键决策历史。',
        examples: ['技术选型决策', '需求优先级调整原因'],
        icon: 'receipt',
        color: '#9f1239',
      },
      {
        key: 'followup_items',
        name: '跟进项',
        description: '跨团队协作中的待追踪事项。',
        examples: ['等待法务反馈合同', '跟进供应商报价'],
        icon: 'check-square',
        color: '#0d9488',
      },
    ],
  },
  {
    id: 'content_creation',
    nameKey: 'library.scenarios.contentCreation.name',
    descriptionKey: 'library.scenarios.contentCreation.description',
    categories: [
      {
        key: 'content_idea',
        name: '内容选题',
        description: '视频、文章、播客等创作选题。',
        examples: ['写一篇提示词工程实践', '做一期效率工具对比'],
        icon: 'lightbulb',
        color: '#dc2626',
      },
      {
        key: 'draft_script',
        name: '草稿脚本',
        description: '内容大纲、文案草稿和脚本结构。',
        examples: ['短视频脚本 v1', '文章提纲草稿'],
        icon: 'notebook',
        color: '#475569',
      },
      {
        key: 'publish_plan',
        name: '发布计划',
        description: '发布时间、渠道和宣发安排。',
        examples: ['下周内容发布表', '发布节奏与渠道安排'],
        icon: 'calendar-clock',
        color: '#2563eb',
      },
      {
        key: 'reference_clip',
        name: '灵感素材',
        description: '收藏的参考素材与案例链接。',
        examples: ['优秀封面参考', '开场文案模板'],
        icon: 'bookmark',
        color: '#be185d',
      },
    ],
  },
  {
    id: 'finance_management',
    nameKey: 'library.scenarios.financeManagement.name',
    descriptionKey: 'library.scenarios.financeManagement.description',
    categories: [
      {
        key: 'reimbursement',
        name: '报销记录',
        description: '待报销与已报销费用流水。',
        examples: ['机票报销 860 元', '打车报销待提交'],
        icon: 'receipt',
        color: '#b45309',
      },
      {
        key: 'bill_record',
        name: '账单记录',
        description: '固定支出和周期账单。',
        examples: ['信用卡账单 3280 元', '服务器月费 299 元'],
        icon: 'wallet',
        color: '#ea580c',
      },
      {
        key: 'budget_plan',
        name: '预算计划',
        description: '月度/季度预算与预算分配。',
        examples: ['3 月预算规划', '旅行预算上限'],
        icon: 'target',
        color: '#ca8a04',
      },
      {
        key: 'income_track',
        name: '收入追踪',
        description: '收入来源和到账记录。',
        examples: ['副业结算到账', '项目回款进度'],
        icon: 'shopping-cart',
        color: '#15803d',
      },
    ],
  },
  {
    id: 'health_life',
    nameKey: 'library.scenarios.healthLife.name',
    descriptionKey: 'library.scenarios.healthLife.description',
    categories: [
      {
        key: 'fitness_plan',
        name: '运动计划',
        description: '训练安排和运动打卡计划。',
        examples: ['每周三次力量训练', '本月跑步目标 80 公里'],
        icon: 'heart-pulse',
        color: '#e11d48',
      },
      {
        key: 'medical_followup',
        name: '就医随访',
        description: '复诊安排、检查提醒和医嘱。',
        examples: ['下周二复诊', '体检报告复查提醒'],
        icon: 'calendar-clock',
        color: '#0f766e',
      },
      {
        key: 'meal_log',
        name: '饮食记录',
        description: '饮食结构、热量和营养记录。',
        examples: ['一周饮食记录', '控制糖分摄入计划'],
        icon: 'notebook',
        color: '#65a30d',
      },
      {
        key: 'weight_log',
        name: '体重记录',
        description: '体重变化记录与目标追踪。',
        examples: ['本周体重趋势', '减脂期每晨称重'],
        icon: 'target',
        color: '#0ea5e9',
      },
      {
        key: 'wellness_goal',
        name: '生活目标',
        description: '睡眠、习惯和身心状态目标。',
        examples: ['连续 30 天早睡', '每日冥想 10 分钟'],
        icon: 'star',
        color: '#7e22ce',
      },
    ],
  },
  {
    id: 'travel_trip',
    nameKey: 'library.scenarios.travelTrip.name',
    descriptionKey: 'library.scenarios.travelTrip.description',
    categories: [
      {
        key: 'travel_plan',
        name: '旅行计划',
        description: '目的地规划和路线安排。',
        examples: ['东京 5 天行程', '国庆自驾路线'],
        icon: 'plane',
        color: '#0284c7',
      },
      {
        key: 'booking_info',
        name: '预订信息',
        description: '机酒车票等预订确认信息。',
        examples: ['酒店预订号', '高铁票订单信息'],
        icon: 'briefcase',
        color: '#1d4ed8',
      },
      {
        key: 'packing_list',
        name: '行李清单',
        description: '出行物品准备与清单核对。',
        examples: ['露营装备清单', '出差行李 checklist'],
        icon: 'check-square',
        color: '#0ea5e9',
      },
      {
        key: 'itinerary_note',
        name: '行程笔记',
        description: '旅途中记录的行程和注意事项。',
        examples: ['Day2 景点开放时间', '机场转机提醒'],
        icon: 'calendar-clock',
        color: '#14b8a6',
      },
    ],
  },
  {
    id: 'software_development',
    nameKey: 'library.scenarios.softwareDevelopment.name',
    descriptionKey: 'library.scenarios.softwareDevelopment.description',
    categories: [
      {
        key: 'bug_report',
        name: '缺陷反馈',
        description: 'bug 复现步骤、影响范围和修复状态。',
        examples: ['分类库导入失败', '移动端布局错位'],
        icon: 'wrench',
        color: '#ef4444',
      },
      {
        key: 'feature_request',
        name: '功能需求',
        description: '新功能建议和需求拆解。',
        examples: ['支持分类多选导入', '增加批量编辑能力'],
        icon: 'lightbulb',
        color: '#8b5cf6',
      },
      {
        key: 'release_note',
        name: '版本发布',
        description: '版本记录、变更说明与发布时间。',
        examples: ['v0.3.2 发布记录', '热修复发布说明'],
        icon: 'book-open',
        color: '#22c55e',
      },
      {
        key: 'code_snippet',
        name: '代码片段',
        description: '可复用代码、命令和实现笔记。',
        examples: ['SQL 优化片段', '接口鉴权中间件模板'],
        icon: 'code',
        color: '#6366f1',
      },
    ],
  },
]


export type CategoryLibraryLocale = 'zh-CN' | 'en'

export type CategoryLibraryCategoryContent = {
  name: string
  description: string
  examples: string[]
}

const CATEGORY_LIBRARY_EN_CONTENT_BY_KEY: Record<string, CategoryLibraryCategoryContent> = {
  todo: {
    name: 'To-do',
    description: 'Tasks or reminders that need action.',
    examples: ['Submit travel reimbursement', 'Book dentist follow-up'],
  },
  idea: {
    name: 'Idea',
    description: 'Ideas, inspirations, or hypotheses to validate.',
    examples: ['Build a morning ritual', 'Write an email automation retrospective'],
  },
  schedule: {
    name: 'Schedule',
    description: 'Events or meetings with a clear date/time.',
    examples: ['Review meeting on Friday 15:00', 'Sync with Lee next Tuesday'],
  },
  note: {
    name: 'Note',
    description: 'Notes, records, summaries, or useful snippets.',
    examples: ['Customer interview highlights', 'Release process checklist'],
  },
  bookmark: {
    name: 'Bookmark',
    description: 'Links or resources to save for later reading.',
    examples: ['https://example.com', 'New model benchmark article'],
  },
  expense: {
    name: 'Expense',
    description: 'Spendings, bills, reimbursements, or payment records.',
    examples: ['Taxi CNY 38', 'Tool subscription CNY 99/month'],
  },
  movie: {
    name: 'Movies & TV',
    description: 'Movies, series, anime, and viewing notes.',
    examples: ['Iron Man', 'The Apothecary Diaries'],
  },
  books: {
    name: 'Books',
    description: 'Books, reading plans, and reading reflections.',
    examples: ['The Count of Monte Cristo', 'Book notes for The Three-Body Problem'],
  },
  watchlist: {
    name: 'Watchlist',
    description: 'A list of movies, shows, or books to consume.',
    examples: ['Finish Nolan films this year', 'Add 3 new books to the list'],
  },
  review_log: {
    name: 'Review Log',
    description: 'Thoughts and reflections after watching or reading.',
    examples: ['Dune Part Two review', 'Three takeaways from this book'],
  },
  meeting_minutes: {
    name: 'Meeting Minutes',
    description: 'Meeting notes, decisions, and follow-up owners.',
    examples: ['Weekly sync minutes', 'Review outcomes and owners'],
  },
  project_plan: {
    name: 'Project Plan',
    description: 'Milestones, task breakdown, and timeline planning.',
    examples: ['Q2 delivery timeline', 'Version milestone plan'],
  },
  decision_log: {
    name: 'Decision Log',
    description: 'Decision records and rationale for key tradeoffs.',
    examples: ['Tech stack decision', 'Priority adjustment rationale'],
  },
  followup_items: {
    name: 'Follow-up Items',
    description: 'Cross-team items that require ongoing tracking.',
    examples: ['Waiting for legal feedback', 'Follow up vendor quotation'],
  },
  content_idea: {
    name: 'Content Ideas',
    description: 'Topics for videos, articles, podcasts, and posts.',
    examples: ['Prompt engineering best practices', 'Productivity tools comparison'],
  },
  draft_script: {
    name: 'Draft Script',
    description: 'Outlines, drafts, and scripting structures.',
    examples: ['Short video script v1', 'Article draft outline'],
  },
  publish_plan: {
    name: 'Publish Plan',
    description: 'Publishing schedule, channels, and promotion plan.',
    examples: ['Next week content calendar', 'Channel launch schedule'],
  },
  reference_clip: {
    name: 'Reference Materials',
    description: 'Saved references, inspirations, and sample assets.',
    examples: ['Cover design references', 'Opening hook templates'],
  },
  reimbursement: {
    name: 'Reimbursement',
    description: 'Pending and completed reimbursement records.',
    examples: ['Flight reimbursement CNY 860', 'Taxi reimbursement pending'],
  },
  bill_record: {
    name: 'Bills',
    description: 'Recurring or one-time bill and payment records.',
    examples: ['Credit card bill CNY 3280', 'Server fee CNY 299/month'],
  },
  budget_plan: {
    name: 'Budget Plan',
    description: 'Monthly or quarterly budget plans and allocations.',
    examples: ['March budget planning', 'Trip budget ceiling'],
  },
  income_track: {
    name: 'Income Tracking',
    description: 'Income sources, settlement, and payout tracking.',
    examples: ['Freelance payout received', 'Project payment progress'],
  },
  fitness_plan: {
    name: 'Fitness Plan',
    description: 'Workout routines, schedules, and progress tracking.',
    examples: ['Three strength sessions weekly', '80 km running target this month'],
  },
  medical_followup: {
    name: 'Medical Follow-up',
    description: 'Appointments, checkups, and medical reminders.',
    examples: ['Follow-up next Tuesday', 'Health report recheck reminder'],
  },
  meal_log: {
    name: 'Meal Log',
    description: 'Nutrition notes, calorie tracking, and meal plans.',
    examples: ['Weekly meal log', 'Reduce sugar intake plan'],
  },
  weight_log: {
    name: 'Weight Log',
    description: 'Track weight changes and progress toward goals.',
    examples: ['Weekly weight trend', 'Daily morning weigh-in during cut'],
  },
  wellness_goal: {
    name: 'Wellness Goals',
    description: 'Sleep, habits, and mental wellness goals.',
    examples: ['Sleep early for 30 days', 'Meditate 10 minutes daily'],
  },
  travel_plan: {
    name: 'Travel Plan',
    description: 'Destination planning and route arrangement.',
    examples: ['Tokyo 5-day itinerary', 'National Day road trip route'],
  },
  booking_info: {
    name: 'Booking Details',
    description: 'Flight, hotel, and transport booking details.',
    examples: ['Hotel reservation number', 'Train ticket order details'],
  },
  packing_list: {
    name: 'Packing List',
    description: 'Packing preparation and checklist review.',
    examples: ['Camping gear checklist', 'Business trip packing checklist'],
  },
  itinerary_note: {
    name: 'Itinerary Notes',
    description: 'On-the-go itinerary notes and reminders.',
    examples: ['Day 2 opening hours', 'Airport transfer reminder'],
  },
  bug_report: {
    name: 'Bug Report',
    description: 'Reproduction steps, impact scope, and fix status.',
    examples: ['Category import failed', 'Mobile layout glitch'],
  },
  feature_request: {
    name: 'Feature Request',
    description: 'New feature ideas and requirement breakdown.',
    examples: ['Support multi-select category import', 'Add batch edit support'],
  },
  release_note: {
    name: 'Release Notes',
    description: 'Version updates, change logs, and release time.',
    examples: ['v0.3.2 release notes', 'Hotfix release summary'],
  },
  code_snippet: {
    name: 'Code Snippet',
    description: 'Reusable code, commands, and implementation notes.',
    examples: ['SQL optimization snippet', 'Auth middleware template'],
  },
}

export const resolveCategoryLibraryLocale = (locale?: string): CategoryLibraryLocale => {
  const normalizedLocale = String(locale ?? '').trim().toLowerCase()
  return normalizedLocale.startsWith('en') ? 'en' : 'zh-CN'
}

export const getLocalizedCategoryLibraryCategory = (
  category: CategoryLibraryCategory,
  locale?: string
): CategoryLibraryCategoryContent => {
  const language = resolveCategoryLibraryLocale(locale)

  if (language === 'en') {
    const english = CATEGORY_LIBRARY_EN_CONTENT_BY_KEY[category.key]
    if (english) {
      return {
        name: english.name,
        description: english.description,
        examples: [...english.examples],
      }
    }
  }

  return {
    name: category.name,
    description: category.description,
    examples: [...category.examples],
  }
}
