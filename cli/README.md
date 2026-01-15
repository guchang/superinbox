# SuperInbox CLI

SuperInbox 命令行工具 - 快速发送内容到你的智能收件箱

## 安装

```bash
# 克隆或进入项目目录
cd /path/to/SuperInbox/cli

# 安装依赖
npm install

# 全局链接（可以在任何地方使用 sinbox 命令）
npm link
```

## 配置

首次使用前需要配置 API 地址：

```bash
# 设置后端 API 地址（默认：http://localhost:3000）
sinbox config set api.url http://localhost:3000

# 如果需要认证，设置 API 密钥
sinbox config set api.key your-api-key

# 验证配置
sinbox status
```

## 使用

### 快速开始

```bash
# 发送内容到收件箱
sinbox add "明天下午3点开会"

# 使用编辑器输入长内容
sinbox edit

# 查看最近的条目
sinbox list

# 查看单个条目详情
sinbox show <id>

# 查看服务状态
sinbox status
```

### 命令详解

#### `add` - 发送内容到收件箱

快速发送文本内容到收件箱，AI 会自动分析意图并分类。

```bash
# 基本使用（显示创建结果后立即返回，AI 在后台处理）
sinbox add "明天下午3点开会"

# 记录支出
sinbox add "买咖啡花了25元" -t expense

# 从 Telegram 发送
sinbox add "重要想法" -s telegram

# 等待 AI 处理完成并查看详细结果
sinbox add "整理文档" -w
```

**选项：**
- `-t, --type <type>` - 内容类型（text, image, url, audio），默认 text
- `-s, --source <source>` - 来源标识，默认 cli
- `-w, --wait` - 等待 AI 处理完成并显示详细结果（包括提取的信息、建议等）

---

#### `edit` - 打开编辑器输入内容

使用系统默认编辑器输入长文本或多行内容，适合编写会议纪要、长篇想法、文章草稿等。

```bash
# 打开编辑器
sinbox edit

# 指定类型和来源
sinbox edit -t note -s journal

# 等待 AI 处理
sinbox edit -w
```

**选项：**
- `-t, --type <type>` - 内容类型，默认 text
- `-s, --source <source>` - 来源标识，默认 cli
- `-w, --wait` - 等待 AI 处理完成

**使用流程：**
1. 执行命令后会打开系统默认编辑器（vim/nano/vscode 等）
2. 在编辑器中输入内容，以 `#` 开头的行会被忽略
3. 保存并关闭编辑器
4. 内容自动发送到收件箱，AI 开始处理

**适用场景：**
- 需要输入多行文本或长内容
- 需要仔细编辑和修改内容
- 复制粘贴大段文字
- 编写结构化的笔记或文档

---

#### `list` (别名: `ls`) - 查看条目列表

查看收件箱中的条目，支持多种筛选和排序。

```bash
# 查看最近 20 条（默认）
sinbox list
sinbox ls  # 使用别名

# 查看最近 10 条
sinbox ls -n 10

# 分页查看（跳过前 20 条）
sinbox ls -o 20

# 查看所有待办事项
sinbox ls --intent todo

# 查看已完成的条目
sinbox ls --status completed

# 查看来自 Telegram 的消息
sinbox ls --source telegram

# 组合筛选：查看已完成的支出记录
sinbox ls --intent expense --status completed

# 以 JSON 格式输出
sinbox ls -j

# 查看最近 5 条待办事项
sinbox ls -n 5 --intent todo
```

**选项：**
- `-n, --limit <number>` - 显示数量，默认 20
- `-o, --offset <number>` - 偏移量（用于分页）
- `--intent <intent>` - 按意图筛选（todo, idea, expense, note, bookmark, schedule）
- `--status <status>` - 按状态筛选（pending, processing, completed, failed）
- `--source <source>` - 按来源筛选
- `-j, --json` - 以 JSON 格式输出

---

#### `show` - 查看条目详情

查看单个条目的完整信息，包括 AI 分析结果。

```bash
# 查看指定条目
sinbox show abc123

# 查看条目的所有字段
sinbox show 1a2b3c4d
```

**参数：**
- `<id>` - 条目 ID（必需）

---

#### `status` - 查看服务状态

检查 SuperInbox 后端服务是否正常运行。

```bash
sinbox status
```

显示信息包括：
- API 连接状态
- 服务版本
- 响应时间

---

#### `config` - 管理配置

配置 CLI 工具的设置，如 API 地址、认证信息等。

```bash
# 查看所有配置
sinbox config get

# 查看特定配置
sinbox config get api.url

# 设置 API 地址
sinbox config set api.url http://localhost:3000

# 设置 API 密钥
sinbox config set api.key your-api-key

# 重置所有配置
sinbox config reset
```

**参数：**
- `<action>` - 操作类型（get, set, reset）
- `[key]` - 配置键（可选）
- `[value]` - 配置值（可选）

---

#### `help` - 帮助信息

显示命令帮助信息。

```bash
# 显示所有命令
sinbox help

# 显示特定命令帮助
sinbox add --help
sinbox list --help
```

## 使用场景

### 场景 1：快速记录待办事项

```bash
# 直接添加
sinbox add "明天下午3点开会讨论项目进度"

# 查看所有待办
sinbox ls --intent todo
```

### 场景 2：记录支出

```bash
# 记录支出
sinbox add "午餐花了45元" -t expense
sinbox add "打车回家30元" -t expense

# 查看所有支出记录
sinbox ls --intent expense
```

### 场景 3：保存灵感和想法

```bash
# 使用编辑器输入长文本
sinbox edit -t note

# 快速记录想法
sinbox add "可以做一个自动化工具来..."
```

### 场景 4：从不同来源收集信息

```bash
# 标记来源
sinbox add "重要链接" -s telegram
sinbox add "会议纪要" -s email

# 按来源查看
sinbox ls --source telegram
```

## 常见问题

### 无法连接到服务器

```bash
# 检查服务状态
sinbox status

# 确认 API 地址配置正确
sinbox config get api.url

# 重新设置 API 地址
sinbox config set api.url http://localhost:3000
```

### 命令找不到

如果提示 `sinbox: command not found`：

```bash
# 重新链接
cd /path/to/SuperInbox/cli
npm link

# 或者使用 npx 运行
npx sinbox add "测试"
```

### 查看详细错误信息

```bash
# 使用 --help 查看命令用法
sinbox add --help

# 查看配置
sinbox config get
```

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 本地测试
npm link
```

## 技术栈

- Node.js
- TypeScript
- Commander.js - CLI 框架
- Chalk - 终端颜色
- Ora - 加载动画

## 相关链接

- [SuperInbox 后端 API](../backend/README.md)
- [SuperInbox Web 界面](../web/README.md)
- [项目文档](../README.md)
