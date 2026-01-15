# SuperInbox 认证指南

## 概述

SuperInbox 使用 API Key 进行身份认证。所有 API 请求都需要在 `Authorization` header 中携带有效的 API Key。

## API Key 格式

```
Authorization: Bearer <your-api-key>
```

## 认证方式

### 1. Web 界面

Web 界面会自动处理 API Key：

1. **首次访问**：系统自动使用默认开发密钥 `dev-key-change-this-in-production`
2. **自定义密钥**：在"系统设置"页面配置自己的 API Key
3. **密钥存储**：API Key 保存在浏览器的 localStorage 中

### 2. CLI 工具

CLI 工具通过配置文件管理 API Key：

```bash
# 查看当前配置
sinbox config get api

# 设置 API Key
sinbox config set api.key your-api-key-here

# 设置 API 地址
sinbox config set api.baseUrl http://localhost:3001/v1
```

### 3. 直接 API 调用

使用 curl 或其他 HTTP 客户端：

```bash
curl -H "Authorization: Bearer dev-key-change-this-in-production" \
  http://localhost:3001/v1/items
```

## 默认开发密钥

```
dev-key-change-this-in-production
```

⚠️ **警告**：默认密钥仅用于开发和测试环境，生产环境必须更换！

## 生产环境 API Key 管理

### 创建新 API Key

通过后端 API 创建（需实现）：

```bash
curl -X POST \
  -H "Authorization: Bearer dev-key-change-this-in-production" \
  -H "Content-Type: application/json" \
  -d '{"name": "My App", "scopes": ["full"]}' \
  http://localhost:3001/v1/settings/api-keys
```

### API Key 权限范围

- `full`: 完全访问权限
- `write`: 读写权限
- `read`: 只读权限

## 安全最佳实践

1. **生产环境**：使用环境变量或密钥管理服务存储 API Key
2. **定期轮换**：定期更换 API Key
3. **最小权限**：根据需要分配最小权限范围
4. **监控使用**：定期检查 API Key 使用日志
5. **不要提交**：永远不要将 API Key 提交到版本控制系统

## 故障排查

### 401 Unauthorized

- 检查 API Key 是否正确
- 确认 API Key 未过期或被撤销
- 验证 Authorization header 格式：`Bearer <key>`

### 403 Forbidden

- 检查 API Key 的权限范围
- 确认 API Key 已激活

### CLI 连接失败

```bash
# 检查配置
sinbox config get api

# 测试后端连接
curl http://localhost:3001/health

# 验证 API Key
curl -H "Authorization: Bearer your-key" http://localhost:3001/v1/items
```
