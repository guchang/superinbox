# SuperInbox CLI / SuperInbox 命令行工具

SuperInbox CLI helps you quickly add, browse, and manage inbox items in terminal.  
SuperInbox CLI 用于在终端中快速写入、浏览和管理收件箱条目。

## 运行要求 / Requirements

- Node.js >= 18

## 安装 / Installation

```bash
cd /path/to/SuperInbox/cli
npm install
npm link
```

## 快速开始 / Quick Start

```bash
# 1) 在仓库根目录启动服务 / Start services from repo root
./start.sh

# 2) 首次配置地址 / Configure endpoints first
sinbox config

# 3) 检查连通性 / Check connectivity
sinbox status

# 4) 注册与登录 / Register and login
sinbox register
sinbox login

# 5) 添加并查看 / Add and list
sinbox add "明天下午 3 点开会"
sinbox list
```

## 认证与配置 / Auth & Config

### 认证命令 / Auth Commands

```bash
# 注册（输出注册链接，需手动打开）/ Prints registration URL (open manually)
sinbox register

# 登录 / Login
sinbox login
sinbox login <username>

# 退出登录 / Logout
sinbox logout
```

- 中文：`list` / `show` / `delete` / `add` / `edit` 需要先登录。
- EN: `list` / `show` / `delete` / `add` / `edit` require login.

### 配置命令 / Config Command

```bash
sinbox config
```

- 中文：配置向导支持语言、后端 API（必须含 `/v1`）、前端 Web 地址、超时、默认 `source`。
- EN: Wizard supports language, backend API URL (must include `/v1`), frontend web URL, timeout, and default `source`.

可通过环境变量预填 / You can prefill via env vars:

```bash
API_BASE_URL=http://localhost:3001/v1
WEB_BASE_URL=http://localhost:3000
API_TIMEOUT=30000
DEFAULT_SOURCE=cli
```

环境变量加载顺序（命中即停止）/ Env load order (first hit wins):

- `当前目录/.env` / `cwd/.env`
- `~/.superinbox/.env`
- `~/.sinboxrc`

## 命令总览 / Command Overview

| Command | 中文说明 | English |
|---|---|---|
| `sinbox add [content]` | 新增条目（支持 `--file`） | Create item (supports `--file`) |
| `sinbox edit` | 打开编辑器输入多行内容 | Open editor for multiline content |
| `sinbox list` / `sinbox ls` | 列表查询（支持筛选） | List items with filters |
| `sinbox show [id]` | 查看详情（不传 id 时选择） | Show details (select when id missing) |
| `sinbox delete [id]` / `sinbox rm [id]` | 删除条目（不传 id 时选择） | Delete item (select when id missing) |
| `sinbox status` | 检查服务状态 | Check server status |
| `sinbox config` | 打开配置向导 | Open config wizard |
| `sinbox register` / `sinbox login` / `sinbox logout` | 账户命令（`register` 仅输出链接） | Account commands (`register` prints URL only) |

## 交互行为 / Interactive Behavior

- `list`：TTY 下可交互；非 TTY 或 `--json` 时自动非交互。  
  `list`: interactive in TTY; non-interactive in non-TTY or with `--json`.
- `show`：不传 `id` 会提示选择；传 `id` 更适合脚本。  
  `show`: prompts for selection without `id`; pass `id` for scripting.
- `delete`：包含确认流程，更适合 TTY 交互。  
  `delete`: includes confirmations; better for TTY workflows.

## 常用参数与示例 / Common Options & Examples

### `add`

```bash
sinbox add "明天下午 3 点开会"
sinbox add "买咖啡花了 25 元" -t text -s cli
sinbox add --file ./note.md
sinbox add "会议纪要" --file ./meeting.txt
sinbox add "整理文档" -w
```

- `-t, --type <type>`: `text` / `image` / `url` / `audio`
- `-s, --source <source>`: source identifier
- `-w, --wait`: wait for AI processing
- `-f, --file <path>`: upload file

### `edit`

```bash
sinbox edit
sinbox edit -t text -s cli
sinbox edit -w
```

### `list` / `ls`

```bash
sinbox list
sinbox ls -n 10
sinbox ls -o 20
sinbox ls --category todo
sinbox ls --status completed
sinbox ls --source telegram
sinbox ls --category expense --status completed
sinbox ls -j
```

- `-n, --limit <number>`: display count
- `-o, --offset <number>`: offset
- `--category <category>`: `todo` / `idea` / `expense` / `note` / `bookmark` / `schedule`
- `--status <status>`: `pending` / `processing` / `completed` / `failed`
- `--source <source>`: filter by source
- `-j, --json`: JSON output

### `show`

```bash
sinbox show <id>
sinbox show
```

### `delete` / `rm`

```bash
sinbox delete <id>
sinbox rm <id>
sinbox delete
```

### `status` / `help`

```bash
sinbox status
sinbox help
sinbox list --help
```

## 脚本示例 / Automation Examples

```bash
sinbox list --json | jq '.[] | .category'
sinbox list --json | jq '.[] | select(.category == "todo")'
sinbox list --limit 5 | grep todo
```

## 常见问题 / FAQ

### 无法连接 / Cannot connect

```bash
sinbox status
sinbox config
```

确认后端已启动且 API 地址可访问。  
Make sure backend is running and API URL is reachable.

### 命令找不到 / Command not found

```bash
cd /path/to/SuperInbox/cli
npm link
# 或 / or
npx sinbox status
```

### 提示需要登录 / Login required

```bash
sinbox login
```

### `register` 不会自动打开浏览器 / `register` does not auto-open browser

`sinbox register` 会打印注册链接（基于 `WEB_BASE_URL`），请手动打开。  
`sinbox register` prints a registration URL (based on `WEB_BASE_URL`), open it manually.

## 开发 / Development

```bash
npm install
npm run build
npm link
```

## 相关链接 / Related Links

- [SuperInbox 后端 API / Backend API](../backend/README.md)
- [SuperInbox 文档中心 / Docs Index](../docs/README.md)
- [项目总览 / Project README](../README.md)
