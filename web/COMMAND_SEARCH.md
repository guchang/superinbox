# 命令搜索功能说明

## 功能概述

SuperInbox 收件箱现在支持强大的命令搜索功能，类似于你截图中的设计。

## 快捷键

- **⌘K** (Mac) 或 **Ctrl+K** (Windows/Linux): 打开/关闭搜索对话框

## 功能特性

### 1. 全文搜索
在搜索框中输入任意文本，会在以下字段中搜索：
- 原始内容 (original_content)
- 摘要 (summary)
- 建议标题 (suggested_title)

### 2. 意图筛选
可以按以下意图类型筛选：
- 待办事项 (todo)
- 想法 (idea)
- 支出 (expense)
- 笔记 (note)
- 书签 (bookmark)
- 日程 (schedule)

### 3. 状态筛选
可以按以下状态筛选：
- 待处理 (pending)
- 处理中 (processing)
- 已完成 (completed)
- 失败 (failed)

### 4. 来源筛选
动态显示所有可用的来源选项（如 cli、web、api 等）

## UI 特性

### 搜索框状态
- **默认状态**: 显示 "搜索... (⌘K)" 提示文本
- **有筛选条件**: 显示当前筛选条件摘要和筛选条件数量徽章
- **点击**: 打开命令搜索对话框

### 对话框布局
- 搜索输入框
- 当前筛选条件（如果有）
- 意图筛选组
- 状态筛选组
- 来源筛选组（动态）
- 搜索操作（当有输入文本时）

### 交互行为
- 点击筛选项后会立即应用筛选并关闭对话框
- 再次点击同一筛选项会取消该筛选
- 可以组合多个筛选条件
- "清除所有筛选" 按钮可以一次性重置所有筛选

## API 集成

### 前端查询参数
```typescript
{
  query?: string      // 全文搜索
  intent?: string     // 意图筛选
  status?: string     // 状态筛选
  source?: string     // 来源筛选
  limit?: number      // 返回数量限制
}
```

### 后端支持
- **API 端点**: `GET /v1/items`
- **认证**: `Authorization: Bearer <api-key>`
- **查询参数**: 支持上述所有筛选参数

### 数据库查询
后端使用 SQL LIKE 进行全文搜索：
```sql
SELECT * FROM items
WHERE user_id = ?
  AND (original_content LIKE ? OR summary LIKE ? OR suggested_title LIKE ?)
  AND intent = ?
  AND status = ?
  AND source = ?
ORDER BY created_at DESC
LIMIT ?
```

## 使用示例

### 示例 1: 搜索包含"会议"的所有条目
1. 按 ⌘K 打开搜索
2. 输入 "会议"
3. 选择 "搜索 '会议'"

### 示例 2: 筛选所有待办事项
1. 按 ⌘K 打开搜索
2. 在意图筛选中选择 "待办事项"

### 示例 3: 查找所有失败的记录
1. 按 ⌘K 打开搜索
2. 在状态筛选中选择 "失败"

### 示例 4: 组合筛选
1. 按 ⌘K 打开搜索
2. 选择意图 "待办事项"
3. 选择状态 "已完成"
4. 可以继续添加其他筛选条件

## 文件结构

### 前端组件
- `/web/src/components/ui/command.tsx` - Command 组件基础实现
- `/web/src/components/shared/command-search.tsx` - 搜索和筛选组件

### 页面集成
- `/web/src/app/(dashboard)/inbox/page.tsx` - 收件箱页面（已集成）

### 后端支持
- `/backend/src/capture/controllers/inbox.controller.ts` - API 控制器
- `/backend/src/storage/database.ts` - 数据库查询层
- `/backend/src/types/index.ts` - 类型定义

## 技术栈

- **前端**: Next.js 15, React 19, shadcn/ui, cmdk
- **后端**: Express, SQLite (better-sqlite3)
- **状态管理**: TanStack Query
- **类型安全**: TypeScript

## 未来改进

可能的增强功能：
- 支持关键词高亮
- 搜索历史记录
- 高级搜索语法（如 AND, OR, NOT）
- 搜索结果排序选项
- 导出搜索结果
- 保存常用搜索条件
