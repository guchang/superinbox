# 访问日志与审计系统

**版本：** 1.0.0
**发布日期：** 2026-01-17
**状态：** ✅ 已实现

---

## 功能概述

访问日志与审计系统为管理员提供了完整的 API 访问记录查看和分析功能，支持：

- 全局日志查看（所有 API Key）
- 单个 Key 的日志查看
- 多维度筛选和搜索
- 日志详情查看
- 日志导出

---

## 使用指南

### 权限要求

需要 JWT Token 包含 `admin:full` scope。

### 访问地址

- **全局日志：** `/settings/logs`
- **单个 Key 日志：** `/settings/api-keys/[id]/logs`

### 筛选功能

**快速筛选：**
- **时间范围：** 今天/本周/本月/自定义
- **状态：** 全部/成功/失败/拒绝
- **搜索：** 接口路径关键词

**高级筛选：**
- **HTTP 方法：** GET/POST/PUT/DELETE
- **IP 地址：** 精确匹配
- **API Key：** 下拉选择（全局日志）

### 导出功能

支持导出为 CSV、JSON、XLSX 格式：

- **小数据集（< 1000 条）：** 同步导出，立即下载
- **大数据集（>= 1000 条）：** 异步导出，完成后通知

**导出字段：**
- timestamp（时间戳）
- method（HTTP 方法）
- endpoint（接口路径）
- statusCode（状态码）
- duration（耗时）
- ip（IP 地址）
- userAgent（User-Agent）
- requestBody（请求体）

---

## 技术实现

### 前端技术栈

- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **TanStack Query**
- **shadcn/ui**

### 关键文件

**类型定义：**
- `/web/src/types/logs.ts` - 日志相关类型

**API 客户端：**
- `/web/src/lib/api/logs.ts` - 日志 API 封装

**Hook：**
- `/web/src/lib/hooks/use-log-filters.ts` - 筛选器状态管理

**UI 组件：**
- `/web/src/components/logs/LogFilters.tsx` - 主筛选器
- `/web/src/components/logs/LogTable.tsx` - 日志表格
- `/web/src/components/logs/LogBadges.tsx` - 徽章组件
- `/web/src/components/logs/LogDetailRow.tsx` - 详情行
- `/web/src/components/logs/LogExportDialog.tsx` - 导出对话框

**页面：**
- `/web/src/app/(dashboard)/settings/logs/page.tsx` - 全局日志页面
- `/web/src/app/(dashboard)/settings/api-keys/[id]/logs/page.tsx` - 单个 Key 日志页面

### 后端实现

**中间件：**
- `/backend/src/middleware/access-logger.ts` - 访问日志记录中间件

**控制器：**
- `/backend/src/auth/logs.controller.ts` - 日志查询和导出控制器

**路由：**
- `/backend/src/auth/logs.routes.ts` - 日志路由定义

**数据库：**
- `/backend/src/storage/migrations/run.ts` - 数据库迁移（版本 002）

---

## 已知限制

1. **导出文件有效期：** 导出文件在服务器上保存 7 天
2. **最大导出记录数：** 单次导出最多 10,000 条
3. **日志保留期限：** 默认保留 90 天（可通过配置调整）
4. **权限要求：** 需要 `admin:full` scope 才能访问

---

## API 端点

### 查询日志

**全局日志：**
```http
GET /v1/auth/logs?page=1&limit=50&status=success&startDate=2026-01-01T00:00:00Z
```

**单个 Key 日志：**
```http
GET /v1/auth/api-keys/{keyId}/logs?page=1&limit=50
```

**查询参数：**
- `page` - 页码（默认 1）
- `limit` - 每页数量（默认 50，最大 200）
- `startDate` - 开始日期（ISO 8601）
- `endDate` - 结束日期（ISO 8601）
- `status` - 状态筛选：success/error/denied
- `method` - HTTP 方法：GET/POST/PUT/DELETE
- `endpoint` - 接口路径（支持模糊搜索）
- `ip` - IP 地址
- `apiKeyId` - API Key ID（仅全局日志）

### 导出日志

**创建导出任务：**
```http
POST /v1/auth/logs/export
Content-Type: application/json

{
  "format": "csv",
  "fields": ["timestamp", "method", "endpoint"],
  "startDate": "2026-01-01T00:00:00Z",
  "endDate": "2026-01-31T23:59:59Z"
}
```

**获取导出状态：**
```http
GET /v1/auth/logs/exports/{exportId}
```

**下载导出文件：**
```http
GET /v1/auth/logs/exports/{exportId}/download
```

---

## 未来改进

- [ ] 日志统计图表（请求量趋势、错误率分布）
- [ ] 实时日志流（WebSocket）
- [ ] 日志告警规则（异常请求检测）
- [ ] 更高级的搜索语法（支持正则表达式）
- [ ] 日志数据可视化仪表板
- [ ] 自动清理过期日志
- [ ] 日志数据归档到对象存储
