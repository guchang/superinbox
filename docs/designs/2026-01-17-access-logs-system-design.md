# 访问日志与审计系统设计文档

**项目：** SuperInbox Web 管理后台
**功能：** 访问日志与审计系统
**设计日期：** 2026-01-17
**设计师：** Claude AI
**状态：** 待实现

---

## 1. 概述

### 1.1 目标

为 SuperInbox 管理后台设计一个完整的访问日志与审计系统，支持：
- 查看所有 API Key 的访问记录（全局日志）
- 查看单个 API Key 的访问记录
- 多维度筛选和搜索
- 日志详情查看
- 日志导出（CSV/JSON/XLSX）

### 1.2 使用场景

- **安全审计** - 查看异常访问、权限拒绝、可疑 IP
- **运维监控** - 查看请求量、响应时间、错误率
- **调试排查** - 查看具体请求的参数和响应

### 1.3 目标用户

- **管理员** - 需要全局日志查看权限（`admin:full` scope）
- **开发者** - 需要调试 API 调用详情
- **运维人员** - 需要监控系统性能和错误

---

## 2. 页面结构

### 2.1 页面列表

| 页面路径 | 说明 | 权限要求 |
|---------|------|---------|
| `/settings/logs` | 全局访问日志页面 | `admin:full` |
| `/settings/api-keys/[id]/logs` | 单个 API Key 的日志页面 | `admin:full` |

### 2.2 组件层级

```
LogTable (共享组件)
├── LogFilters
│   ├── QuickFilters
│   ├── AdvancedFilters
│   └── FilterTags
├── Table
│   ├── LogRow
│   └── LogDetailRow (展开)
├── Pagination
└── LogExportDialog

页面特定组件：
├── GlobalLogsPage (/settings/logs)
└── ApiKeyLogsPage (/settings/api-keys/[id]/logs)
    └── ApiKeyInfoHeader
```

---

## 3. 核心组件设计

### 3.1 日志筛选器 (LogFilters)

#### 快速筛选区（始终可见）

- **时间范围快速选择**：今天/本周/本月/自定义
- **状态筛选**：全部/成功/失败/拒绝
- **搜索框**：接口路径关键词搜索
- **高级筛选切换按钮**：显示已启用徽章

#### 高级筛选区（可折叠）

- **HTTP 方法**：多选（GET/POST/PUT/DELETE）
- **IP 地址**：文本输入
- **状态码范围**：最小/最大值
- **API Key 选择**：下拉选择（仅全局日志）

#### 已选筛选标签

- 显示当前启用的筛选条件
- 点击 ✕ 快速移除

#### URL 状态同步

所有筛选条件同步到 URL 查询参数：
```
/settings/logs?timeRange=today&status=success&q=inbox&page=1
```

### 3.2 日志表格 (LogTable)

#### 表格列

| 列名 | 宽度 | 说明 |
|------|------|------|
| 复选框 | 50px | 批量选择 |
| 时间 | 180px | 日期 + 时间 |
| 接口路径 | 自适应 | 代码风格显示 |
| HTTP 方法 | 100px | 彩色徽章 |
| 状态 | 120px | 状态徽章 + 状态码 |
| 耗时 | 100px | 颜色标识（绿/黄/红） |
| IP 地址 | 150px | 文本显示 |
| API Key | 180px | 仅全局日志显示 |
| 展开 | 80px | ▼/▲ 图标 |

#### 详情展开行

点击展开图标显示：

**请求详情：**
- 完整 URL（含查询参数）
- 请求体（JSON 格式化）
- 请求头（可折叠）

**响应详情：**
- 状态码
- 响应大小
- 响应时间

**错误信息（如有）：**
- 错误码
- 错误消息
- 详细描述

#### 视觉设计

- **方法徽章颜色**：
  - GET: 蓝色 (`#dbeafe` / `#1e40af`)
  - POST: 绿色 (`#dcfce7` / `#166534`)
  - PUT: 黄色 (`#fef3c7` / `#92400e`)
  - DELETE: 红色 (`#fee2e2` / `#991b1b`)

- **状态徽章颜色**：
  - 成功: 绿色 (`bg-green-100`)
  - 失败: 红色 (`bg-red-100`)
  - 拒绝: 黄色 (`bg-yellow-100`)

- **耗时颜色**：
  - < 100ms: 绿色
  - 100-500ms: 黄色
  - > 500ms: 红色

### 3.3 分页控制

#### 混合模式策略

- **默认**：传统分页（页码按钮）
- **加载更多**：可切换到无限滚动
- **最大限制**：加载超过 1000 条提示使用导出功能

#### 分页组件

- 显示范围：`显示 1-20 条，共 1,523 条`
- 页码按钮：上一页/1/2/3/.../153/下一页
- 每页条数：20/50/100 条可选择

### 3.4 导出对话框

#### 导出格式选择

- CSV - 适合 Excel
- JSON - 适合程序处理
- XLSX - Excel 原生格式

#### 字段选择

多选框网格：
- ✅ 时间戳
- ✅ HTTP 方法
- ✅ 接口路径
- ✅ 状态码
- ✅ 耗时
- ⬜ IP 地址
- ⬜ User-Agent
- ⬜ 请求体

#### 时间范围提示

显示当前筛选器的时间范围和预估记录数

---

## 4. 交互流程

### 4.1 导出流程

#### 场景 A：小数据集（< 1000 条）- 同步导出

1. 用户点击"导出日志"按钮
2. 显示导出对话框
3. 选择格式和字段
4. 点击"开始导出"
5. 显示加载动画（3-5秒）
6. 自动触发浏览器下载
7. 显示成功提示

#### 场景 B：大数据集（≥ 1000 条）- 异步导出

1. 用户点击"导出日志"按钮
2. 显示导出对话框，显示大数据集警告
3. 选择格式和字段
4. 点击"开始导出"
5. 调用后端导出 API，获得 `exportId`
6. 显示任务创建通知："导出任务已创建，完成后将自动下载"
7. 后台轮询导出状态（每 3 秒）
8. 完成后自动触发下载，显示成功通知

#### 导出状态通知

**任务创建：**
```
✅ 导出任务已创建
📊 正在处理 1,523 条记录...
⏰ 预计需要 2-3 分钟
```

**处理中：**
```
📥 导出任务进行中...
当前进度：已完成 60%
```

**完成：**
```
✅ 导出完成！
文件：logs-20260115.csv (2.3 MB)
[重新下载]
```

### 4.2 日志详情查看

1. 用户点击表格行的 ▼ 图标
2. 展开详情行
3. 显示请求/响应详情
4. 错误记录显示错误信息面板
5. 再次点击 ▲ 收起详情

---

## 5. 数据流与状态管理

### 5.1 状态架构

```
URLSearchParams (单一数据源)
    ↓
useLogFilters() Hook
    ↓
TanStack Query (数据缓存)
    ↓
UI Components
```

### 5.2 URL 状态管理

使用 `next/navigation` 的 `useSearchParams`：

```typescript
const { filters, updateFilter, resetFilters } = useLogFilters()

// 读取筛选条件
filters.timeRange  // 'today'
filters.status     // 'success'
filters.page       // 1

// 更新筛选条件（自动同步到 URL）
updateFilter('status', 'error')
// URL 变为: /settings/logs?timeRange=today&status=error&page=1
```

### 5.3 TanStack Query 配置

**查询钩子：**

```typescript
// 全局日志
useAccessLogs(filters)

// 单个 Key 日志
useApiKeyLogs(keyId, filters)

// 导出状态轮询
useExportStatus(exportId)
```

**缓存策略：**

- `staleTime: 30000` - 30 秒内数据视为新鲜
- `gcTime: 300000` - 5 分钟后清除缓存
- 自动重新获取：filters 变化时
- 窗口聚焦：不重新获取（避免频繁请求）

### 5.4 错误处理

**全局错误边界：**

- 捕获组件错误
- 显示友好错误提示
- 提供"重新加载"按钮

**API 错误处理：**

- 401 未授权 → 跳转登录页
- 403 权限不足 → 显示权限错误提示
- 4xx 客户端错误 → 不重试
- 5xx 服务器错误 → 重试 2 次

---

## 6. 权限控制

### 6.1 菜单可见性

仅 `admin:full` 权限用户可见：

```typescript
{authState.user?.scopes.includes('admin:full') && (
  <SidebarMenuItem>
    <SidebarMenuButton asChild>
      <a href="/settings/logs">
        <FileText className="h-4 w-4" />
        <span>访问日志</span>
      </a>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
```

### 6.2 页面访问控制

```typescript
// pages/logs/page.tsx
export default function LogsPage() {
  const { authState } = useAuth()

  // 没有权限，显示提示
  if (!authState.user?.scopes.includes('admin:full')) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>权限不足</AlertTitle>
        <AlertDescription>
          您需要 admin:full 权限才能访问此页面
        </AlertDescription>
      </Alert>
    )
  }

  return <LogsContent />
}
```

---

## 7. 性能优化

### 7.1 虚拟滚动（可选）

使用 `@tanstack/react-virtual` 处理超长列表：
- 仅渲染可见区域
- 预渲染上下各 5 行
- 减少节点数量

### 7.2 防抖搜索

搜索输入延迟 500ms 后再触发查询：
```typescript
const debouncedUpdate = useDebouncedCallback(
  (value) => updateFilter('searchQuery', value),
  500
)
```

### 7.3 数据分页

- 默认每页 20 条
- 最大每页 100 条
- 超过 1000 条提示使用导出

### 7.4 代码分割

```typescript
// 懒加载导出对话框
const LogExportDialog = lazy(() => import('@/components/logs/LogExportDialog'))
```

---

## 8. 技术栈

### 8.1 前端框架

- **Next.js 15** - App Router
- **React 19** - Hooks
- **TypeScript** - 类型安全

### 8.2 UI 组件库

- **shadcn/ui** - 基础组件
- **Tailwind CSS** - 样式
- **Radix UI** - 无样式组件
- **Lucide React** - 图标

### 8.3 状态管理

- **TanStack Query** - 服务端状态
- **URLSearchParams** - 客户端筛选状态
- **React Context** - 认证状态

### 8.4 工具库

- **date-fns** - 日期格式化
- **use-debounce** - 防抖
- **sonner** - Toast 通知
- **@tanstack/react-virtual** - 虚拟滚动（可选）

---

## 9. API 对接

### 9.1 已实现的后端 API

```typescript
// 获取全局日志
GET /auth/logs?page=1&limit=20&startDate=...&endDate=...

// 获取单个 Key 的日志
GET /auth/api-keys/{keyId}/logs?page=1&limit=20

// 导出日志（同步）
GET /auth/logs/export?format=csv&...

// 创建导出任务（异步）
POST /auth/api-keys/{keyId}/logs/export
Body: { format: 'csv', fields: [...] }

// 获取导出状态
GET /auth/logs/exports/{exportId}

// 下载导出文件
GET /auth/logs/exports/{exportId}/download
```

### 9.2 API 客户端封装

```typescript
// lib/api/logs.ts
export async function getAccessLogs(filters: LogFilters): Promise<LogsResponse> {
  const params = new URLSearchParams()
  // 构建查询参数...
  const response = await fetch(`/api/v1/auth/logs?${params}`)
  return response.json()
}

export async function getApiKeyLogs(keyId: string, filters: LogFilters): Promise<LogsResponse> {
  // 类似实现...
}
```

---

## 10. 设计规范

### 10.1 颜色系统

| 用途 | 颜色 | Hex |
|------|------|-----|
| 主背景 | Slate 50 | `#f8fafc` |
| 卡片背景 | White | `#ffffff` |
| 边框 | Slate 200 | `#e2e8f0` |
| 主文本 | Slate 900 | `#0f172a` |
| 次要文本 | Slate 500 | `#64748b` |
| 成功 | Green | `#22c55e` |
| 警告 | Yellow | `#f59e0b` |
| 错误 | Red | `#ef4444` |

### 10.2 间距规范

使用 4px 基础单位：
- 4px (0.25rem)
- 8px (0.5rem)
- 12px (0.75rem)
- 16px (1rem)
- 20px (1.25rem)
- 24px (1.5rem)

### 10.3 圆角规范

- 小圆角：`rounded` (6px) - 按钮、输入框
- 中圆角：`rounded-md` (8px) - 卡片内部元素
- 大圆角：`rounded-lg` (12px) - 卡片容器

### 10.4 阴影规范

- 微妙阴影：`shadow-sm` - `0 1px 3px rgba(0,0,0,0.1)`
- 卡片阴影：`shadow` - `0 4px 6px rgba(0,0,0,0.1)`

---

## 11. 响应式设计

### 11.1 断点

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### 11.2 移动端适配

- 筛选器：垂直堆叠
- 表格：横向滚动
- 操作按钮：堆叠显示
- 对话框：全屏显示

---

## 12. 可访问性

### 12.1 键盘导航

- Tab 键遍历所有交互元素
- Enter/Space 触发按钮
- Escape 关闭对话框

### 12.2 屏幕阅读器

- 语义化 HTML 标签
- ARIA 标签
- 图标替代文本

### 12.3 颜色对比

- 文本与背景对比度 ≥ 4.5:1
- 状态徽章使用颜色 + 文本双重标识

---

## 13. 实施计划

### 13.1 第一阶段（核心功能）

1. ✅ 创建页面路由和基础布局
2. ✅ 实现 LogFilters 组件
3. ✅ 实现 LogTable 组件
4. ✅ 集成 TanStack Query
5. ✅ URL 状态管理
6. ✅ 权限控制

### 13.2 第二阶段（增强功能）

7. ✅ LogDetailRow 详情展开
8. ✅ 导出对话框
9. ✅ 同步/异步导出逻辑
10. ✅ 导出状态轮询
11. ✅ Toast 通知集成

### 13.3 第三阶段（优化）

12. ⏳ 性能优化（虚拟滚动、防抖）
13. ⏳ 错误处理完善
14. ⏳ 单元测试
15. ⏳ 响应式适配

---

## 14. 验收标准

### 14.1 功能验收

- ✅ 可以查看全局访问日志
- ✅ 可以按时间、状态、方法等筛选
- ✅ 可以搜索接口路径
- ✅ 可以展开查看日志详情
- ✅ 可以导出日志（CSV/JSON/XLSX）
- ✅ 权限控制正确

### 14.2 性能验收

- ✅ 首屏加载 < 2 秒
- ✅ 筛选响应 < 500ms
- ✅ 表格滚动流畅（60fps）
- ✅ 导出 1000 条 < 30 秒

### 14.3 用户体验验收

- ✅ 交互反馈及时（Loading、Success、Error）
- ✅ 错误提示友好
- ✅ 移动端可用
- ✅ 键盘导航流畅

---

## 15. 附录

### 15.1 相关文件

- **视觉设计示意图**: `/docs/designs/access-logs-wireframe.html`
- **API 文档**: `/SuperInbox-Core-API文档.md`
- **后端实现**: `/backend/src/auth/controllers/logs.controller.ts`

### 15.2 参考资源

- [shadcn/ui 文档](https://ui.shadcn.com/)
- [TanStack Query 文档](https://tanstack.com/query/latest)
- [Next.js App Router 文档](https://nextjs.org/docs/app)

---

**文档版本：** v1.0
**最后更新：** 2026-01-17
**状态：** ✅ 设计完成，待评审
