# memos 可借鉴要点

## 背景与目标

SuperInbox 目前定位为“数字化信息的统一入口与智能路由系统”，核心价值在于多渠道采集、AI 解析以及面向 Notion、Obsidian、Webhook、MCP 等多终端的智能分发。相比之下，memos 是偏内容消费与沉淀的笔记/知识库产品。为避免外部误解“SuperInbox ≈ memos”、同时吸纳优秀实践，本文梳理 memos 中值得引入 SuperInbox 的产品功能与技术架构要点，并结合现状给出落地思路。

## 产品能力借鉴

### 更完备的 Markdown/富文本体验

memos 原生 Markdown 编辑、内联图片/附件、引用等体验成熟；SuperInbox 当前主要承担“入口+路由”，在“内容消费”“轻量修订”上较薄。可在 Web 前端补充：

- 收件箱详情页增加 Markdown 渲染、图片/附件预览，方便分发前校验。
- 支持基础编辑或备注字段（例如修正 AI 解析前），减少来回切换到下游系统。

### 多视图与筛选方式

memos 提供列表/瀑布流等视图、标签与快捷筛选。SuperInbox 收件箱一旦堆积，很需要高效的浏览方式。可借鉴：

- 提供列表/网格/分组等视图切换；配合“按来源”“按意图”的快捷过滤。
- 结合现有 AI 标签与路由状态，增加“待路由”“失败”“按优先级”等一键筛选。

### 团队协作与权限体验

memos 支持多人账号、团队空间和共享 Wiki。SuperInbox 已有 API Key scope，但产品层面尚未强化协作场景。可逐步引入：

- 在 Web 端支持角色/空间配置，让同一入口可供多个部门共享。
- 列表内展示操作日志或责任人，结合访问日志功能形成闭环。

### 附件与媒体管理

memos 拥有文件服务和 S3 插件，可以在笔记里顺畅引用附件。SuperInbox 虽然支持上传及下游同步，但缺少浏览、复用能力。建议：

- 在收件箱详情中集中显示附件缩略图、原始来源信息，并允许二次分发。
- 借鉴 memos 的 S3/本地存储切换策略，为企业部署提供更灵活的介质选择。

### Webhook/自动化配置体验

memos 的 Webhook 与 CEL filter 允许用户基于事件触发自定义逻辑。SuperInbox 现有路由规则已经很强，但可参考其“可视化配置 + 语法表达式”方式，优化规则编排界面并引入更灵活的条件表达能力，降低写 JSON 的门槛。

## 技术与架构实践借鉴

### 双协议 API（Connect RPC + REST）

memos 通过同一套 service 层同时暴露 Connect RPC（浏览器）和 gRPC-Gateway（REST），统一代码、兼顾性能。SuperInbox 若计划开放高吞吐或实时接口，可考虑：

- 保持现有 Express/REST 入口，同时评估引入 gRPC/Connect 以服务内部组件或大客户。
- 在路由、AI 服务之间采用二进制协议，以减少序列化损耗。

### 插件式扩展体系

memos 将 scheduler、email、webhook、storage 等拆分为 `plugin/*`，形成清晰的扩展点。SuperInbox 的 Channel Bot、MCP 适配器、路由动作等可以参照：

- 定义 adapter/plugin 接口与生命周期管理，便于社区贡献自定义分发目标。
- 将定时任务、告警、导出等能力模块化，减少核心仓库耦合。

### 多数据库驱动与迁移治理

memos 在 store 层抽象统一 Driver，并提供 SQLite/MySQL/Postgres 三套实现与迁移脚本。SuperInbox 目前只有 SQLite，可借鉴其模式，为未来多实例/云部署做准备：

- 抽象 Repository/Driver 接口，隔离数据库实现。
- 引入系统化 migration 工具（Knex、Prisma 或自研），并规划版本号治理。

### 前端状态管理分层

memos 通过 React Query 管理服务端状态，Context 管理客户端状态，保证查询与 UI 独立。SuperInbox 前端在功能增多后，可对照整理：

- 将 API 请求统一封装为 hooks，设置缓存策略和错误处理。
- Client state（视图、选择状态）与 server state 分离，提升可维护性。

### 协议/类型生成链路

memos 使用 Protocol Buffers + buf 同步生成 Go/TS 代码，保障前后端类型一致。SuperInbox 在 AI/路由数据结构逐渐复杂后，可以考虑：

- 采用 JSON Schema/Proto 描述核心数据模型，配套代码生成，减少手写 DTO。
- 为 MCP/适配器配置提供 schema 验证，提升配置可靠性。

## 后续建议

1. **产品演进路线**：优先聚焦“内容展示/筛选体验 + 附件浏览”，这些能力直接支撑当前用户协作与路由效率。
2. **工程演进路线**：评估插件化与存储抽象的投入产出，比照 memos 经验，逐步把适配器、任务调度等组件模块化。
3. **对外沟通**：将本文内容整合到对外 FAQ/演示中，说明 SuperInbox 与 memos 的差异与互补，并强调我们计划借鉴的亮点。

通过吸收 memos 的成熟体验，SuperInbox 可以在“以入口和自动化为核心”的前提下，提供更完整的内容消费与协作能力，也为长远的多数据库、插件生态打下基础。
