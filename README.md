# SuperInbox

数字化信息的统一入口与智能路由系统

## 快速开始

### 一键启动

**macOS / Linux:**
```bash
./start.sh
```

**Windows / macOS / Linux (跨平台):**
```bash
node start.js
```

启动工具会自动:
- ✅ 检查依赖
- ✅ 检测端口占用并提供处理选项
- ✅ 启动前后端服务

**服务地址:**
- 前端: http://localhost:3001
- 后端: http://localhost:3000/v1

## 常用命令

```bash
# 查看状态
./start.sh status

# 停止服务
./start.sh stop

# 重启服务
./start.sh restart
```

## MCP (Codex / Claude Code)

本项目提供 stdio MCP Server，供 Codex 或 Claude Code 调用。使用方式：

1) 先启动后端服务（确保 `http://127.0.0.1:3000` 可访问）
2) 在你的 MCP 配置里新增如下服务（请替换为你的绝对路径和 API Key）：

```json
{
  "mcpServers": {
    "superinbox": {
      "command": "/path/to/SuperInbox/backend/node_modules/.bin/tsx",
      "args": ["/path/to/SuperInbox/backend/src/mcp/server.ts"],
      "env": {
        "SUPERINBOX_BASE_URL": "http://127.0.0.1:3000",
        "SUPERINBOX_API_KEY": "sinbox_xxx"
      }
    }
  }
}
```


## 文档

- [快速开始指南](./QUICKSTART.md) - 5分钟快速上手
- [启动工具使用说明](./启动工具使用说明.md) - 详细的启动工具文档
- [项目背景](./项目背景.md) - 项目定位和目标
- [技术架构说明书](./技术架构说明书.md) - 架构设计
- [SuperInbox Core API 文档](./SuperInbox-Core-API文档.md) - 后端 API 接口

## 项目结构

```
SuperInbox/
├── backend/        # 后端服务 (Express + SQLite)
├── web/            # 前端界面 (Next.js + React)
├── cli/            # CLI 工具
├── start.sh        # Bash 启动脚本
├── start.js        # Node.js 启动脚本
└── README.md       # 本文件
```

## 端口配置

默认端口:
- 后端: 3000
- 前端: 3001

自定义端口:
```bash
BACKEND_PORT=8080 FRONTEND_PORT=8081 ./start.sh
```

## 系统要求

- Node.js >= 18.0.0
- npm
- macOS / Linux / Windows

## 许可证

MIT
