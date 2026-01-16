# SuperInbox CLI 交互式功能指南

## 概述

CLI 的 list、show、delete 命令现在支持交互式操作，提供更好的用户体验。

## 命令详解

### 1. list - 列表命令

**基本用法:**
```bash
sinbox list
sinbox ls
```

**筛选选项:**
```bash
# 按意图筛选
sinbox list --intent todo

# 按状态筛选
sinbox list --status completed

# 按来源筛选
sinbox list --source cli

# 限制显示数量
sinbox list --limit 10

# JSON 格式输出
sinbox list --json
```

**交互式操作:**

执行 `sinbox list` 后，会显示条目列表，然后提供以下操作选项：

- **查看详情**: 从列表中选择一个条目查看详细信息
- **删除条目**: 从列表中选择一个条目进行删除
- **刷新列表**: 重新获取最新的条目列表
- **退出**: 退出命令

### 2. show - 详情命令

**基本用法:**
```bash
# 不带参数，交互式选择
sinbox show

# 带条目 ID
sinbox show abc123
```

**交互式操作:**

查看详情后，提供以下操作选项：

- **编辑条目**: 编辑当前条目（功能开发中）
- **删除条目**: 删除当前条目
- **返回列表**: 返回条目列表
- **退出**: 退出命令

### 3. delete - 删除命令

**基本用法:**
```bash
# 不带参数，交互式选择要删除的条目
sinbox delete

# 带条目 ID
sinbox delete abc123
```

**删除流程:**

1. 选择要删除的条目（如果不提供 ID）
2. 显示条目详细信息（内容、意图、状态、摘要）
3. 确认删除
4. 删除成功后，询问是否继续删除其他条目

## 使用示例

### 示例 1: 查看并删除条目

```bash
$ sinbox list
# 显示列表...
? 选择操作: (Use arrow keys)
❯ 查看详情
  删除条目
  刷新列表
  退出

# 选择"查看详情"
? 选择要查看的条目: (Use arrow keys)
❯ 明天下午3点和张三开会
  买咖啡花了25元
  突然想到可以做一个自动整理邮件的工具

# 查看详情后
? 选择操作: (Use arrow keys)
❯ 编辑条目
  删除条目
  返回列表
  退出
```

### 示例 2: 快速删除

```bash
$ sinbox delete
? 选择要删除的条目: (Use arrow keys)
❯ 买咖啡花了25元 (expense)
  明天下午3点和张三开会 (schedule)

即将删除以下条目:
  内容: 买咖啡花了25元
  意图: expense
  状态: completed
  摘要: 记录了一笔咖啡支出

? 确定要删除此条目吗? (y/N) y
✔ 删除成功

? 是否继续删除其他条目? (y/N) n
```

### 示例 3: 管道模式（非交互式）

```bash
# 在脚本或管道中使用，自动禁用交互式提示
sinbox list --json | jq '.[] | .intent'
sinbox list --limit 5 | grep todo
```

## 特性

1. **智能检测**: 自动检测是否在交互式终端（TTY）中运行
   - 在交互式终端中：启用交互式操作
   - 在脚本/管道中：禁用交互式操作

2. **无缝导航**: 命令之间可以相互调用
   - list → show → list
   - show → delete → list
   - delete → delete（连续删除）

3. **中文友好**: 所有提示和消息都是中文

4. **向后兼容**: 仍然支持原有的命令行参数方式

## 注意事项

1. **JSON 模式**: 使用 `--json` 选项时，会禁用交互式操作
2. **脚本使用**: 在脚本中调用这些命令时，会自动禁用交互式操作
3. **权限**: 删除操作需要确认，防止误删
4. **Token**: 如果已登录，使用 JWT token 认证；否则使用 API key

## 最佳实践

```bash
# 日常使用 - 交互式浏览
sinbox list

# 快速查看 - 带参数
sinbox list --limit 5 --status pending

# 脚本使用 - JSON 输出
sinbox list --json | jq '.[] | select(.intent == "todo")'

# 删除流程 - 安全删除
sinbox delete
# 1. 选择条目
# 2. 确认删除
# 3. 可选择继续删除
```
