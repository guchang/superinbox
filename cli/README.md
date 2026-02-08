# SuperInbox CLI

SuperInbox 命令行工具，用于在终端中快速写入、浏览和管理收件箱条目。

## 安装

```bash
cd /path/to/SuperInbox/cli
npm install
npm link
```

## 快速开始

```bash
# 1) 启动服务（在仓库根目录）
./start.sh

# 2) 检查连通性
sinbox status

# 3) 首次使用先登录（或先注册）
sinbox register
sinbox login

# 4) 添加并查看条目
sinbox add "明天下午 3 点开会"
sinbox list
```

## 认证与配置

### 认证命令

```bash
# 注册（打开网页注册入口）
sinbox register

# 登录
sinbox login
sinbox login <username>

# 退出登录
sinbox logout
```

说明：`list` / `show` / `delete` / `add` / `edit` 需要已登录。未登录时会提示执行 `sinbox login`。

### 配置命令

```bash
# 进入交互式配置向导
sinbox config
```

可在配置向导中调整：
- 语言（中文/英文）
- API 地址与超时
- 默认 source/type
- 展示偏好与行为设置

## 命令总览

- `sinbox add [content]`：新增条目（支持 `--file`）
- `sinbox edit`：打开编辑器输入多行内容
- `sinbox list` / `sinbox ls`：列表查询（支持筛选）
- `sinbox show [id]`：查看详情（不传 id 时交互选择）
- `sinbox delete [id]` / `sinbox rm [id]`：删除条目（不传 id 时交互选择）
- `sinbox status`：检查服务状态
- `sinbox config`：打开配置向导
- `sinbox register` / `sinbox login` / `sinbox logout`：账号相关命令

## 交互式模式

CLI 的 `list`、`show`、`delete` 支持交互式流程（TTY 环境下）。

### `list` 交互操作

执行 `sinbox list` 后可选择：
- 查看详情
- 删除条目
- 刷新列表
- 退出

### `show` 交互操作

执行 `sinbox show`（不传 ID）会先让你选择条目，查看后可选择：
- 编辑条目（当前仅提示进行中）
- 删除条目
- 返回列表
- 退出

### `delete` 交互操作

执行 `sinbox delete`（不传 ID）会先让你选择条目，然后：
1. 展示条目摘要（内容/分类/状态/摘要）
2. 二次确认删除
3. 删除后可选择返回列表、继续删除、退出

### 何时禁用交互

以下场景会自动按非交互模式执行：
- 管道/脚本环境（非 TTY）
- `list --json` 输出模式

## 命令详解

### `add` - 发送内容到收件箱

```bash
# 基本使用
sinbox add "明天下午 3 点开会"

# 指定类型和来源
sinbox add "买咖啡花了 25 元" -t text -s cli

# 上传文件（content 可选）
sinbox add --file ./note.md
sinbox add "会议纪要" --file ./meeting.txt

# 等待 AI 处理完成
sinbox add "整理文档" -w
```

选项：
- `-t, --type <type>`：内容类型（`text` / `image` / `url` / `audio`）
- `-s, --source <source>`：来源标识
- `-w, --wait`：等待 AI 处理结果
- `-f, --file <path>`：上传文件

### `edit` - 打开编辑器输入内容

```bash
sinbox edit
sinbox edit -t text -s cli
sinbox edit -w
```

使用流程：
1. 打开系统默认编辑器
2. 输入内容并保存
3. 自动发送到收件箱

### `list` / `ls` - 查看条目列表

```bash
# 默认最近 20 条
sinbox list

# 数量与分页
sinbox ls -n 10
sinbox ls -o 20

# 按分类 / 状态 / 来源筛选
sinbox ls --category todo
sinbox ls --status completed
sinbox ls --source telegram

# 组合筛选
sinbox ls --category expense --status completed

# JSON 输出
sinbox ls -j
```

选项：
- `-n, --limit <number>`：显示数量
- `-o, --offset <number>`：偏移量
- `--category <category>`：分类筛选（`todo` / `idea` / `expense` / `note` / `bookmark` / `schedule`）
- `--status <status>`：状态筛选（`pending` / `processing` / `completed` / `failed`）
- `--source <source>`：来源筛选
- `-j, --json`：JSON 输出

### `show` - 查看条目详情

```bash
# 指定 ID
sinbox show <id>

# 不传 ID，交互选择
sinbox show
```

### `delete` / `rm` - 删除条目

```bash
# 指定 ID 删除
sinbox delete <id>
sinbox rm <id>

# 不传 ID，交互选择
sinbox delete
```

### `status` - 检查服务状态

```bash
sinbox status
```

会展示服务版本、状态、接口地址和当前登录状态。

### `help` - 查看帮助

```bash
sinbox help
sinbox list --help
```

## 脚本与自动化示例

```bash
# 输出分类字段
sinbox list --json | jq '.[] | .category'

# 过滤待办
sinbox list --json | jq '.[] | select(.category == "todo")'

# 文本处理
sinbox list --limit 5 | grep todo
```

## 常见问题

### 无法连接到服务器

```bash
sinbox status
sinbox config
```

确认服务已启动，且配置中的 API 地址可访问。

### 命令找不到

```bash
cd /path/to/SuperInbox/cli
npm link
# 或
npx sinbox status
```

### 提示需要登录

```bash
sinbox login
```

如果已有会话过期，可先执行 `sinbox logout` 后重新登录。

## 开发

```bash
npm install
npm run build
npm link
```

## 相关链接

- [SuperInbox 后端 API](../backend/README.md)
- [SuperInbox 文档中心](../docs/README.md)
- [项目文档](../README.md)
