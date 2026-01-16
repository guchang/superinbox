# CLI 登录安全性说明

## 安全特性

### ✅ 已实现的安全措施

#### 1. 密码隐藏输入
- 使用 inquirer 的 `type: 'password'` 和 `mask: '*'`
- 密码输入时显示为星号，不会在终端明文显示
- 示例：
  ```bash
  $ sinbox login
  ? 用户名: testuser
  ? 密码: ******
  ```

#### 2. 密码不存储
- 登录时只将密码发送到服务器进行验证
- 本地只保存 JWT Token 和用户信息
- 配置文件中不包含任何密码信息

#### 3. 禁止命令行参数传递密码
- **安全风险**：`sinbox login username password` 会在进程列表和 shell 历史中暴露密码
- **当前实现**：即使提供用户名，密码也必须通过交互式输入
- 支持两种安全的登录方式：
  ```bash
  # 方式 1：交互式输入用户名和密码
  sinbox login

  # 方式 2：提供用户名，交互式输入密码
  sinbox login testuser
  ```

#### 4. JWT Token 管理
- 使用 JWT Token 进行身份验证
- Token 自动在请求中添加（通过 Axios interceptor）
- Access Token 有效期：7 天
- Refresh Token 有效期：30 天

## 配置文件存储

### 存储位置
- macOS/Linux: `~/.config/superinbox-cli/config.json`
- Windows: `%APPDATA%\superinbox-cli\config.json`

### 存储内容
```json
{
  "api": {
    "baseUrl": "http://localhost:3001/v1",
    "key": "dev-key-change-this-in-production",
    "timeout": 30000
  },
  "auth": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "951ef71d-0e0e-4ef1-afda-6300ece6daa2",
      "username": "testuser",
      "email": "test@example.com",
      "role": "user"
    }
  }
}
```

### ⚠️ 已知风险

#### Token 明文存储
- JWT Token 以明文形式存储在配置文件中
- 如果配置文件被他人获取，可能导致账户被盗用
- **缓解措施**：
  - 配置文件权限设置为仅当前用户可读（0600）
  - Token 有过期时间限制
  - 用户应及时退出登录

#### 改进建议
1. **使用系统密钥链**
   - macOS: Keychain
   - Linux: Secret Service API (gnome-keyring, kwallet)
   - Windows: Credential Manager
   - 优点：系统级加密存储
   - 缺点：需要额外的系统依赖

2. **Token 加密存储**
   - 使用用户特定的密钥加密 Token
   - 优点：无需额外依赖
   - 缺点：密钥仍需存储在本地

## 安全最佳实践

### 用户建议

1. **及时退出登录**
   ```bash
   sinbox logout
   ```

2. **不要在共享计算机上保持登录状态**

3. **定期更改密码**
   - 在 Web 界面中更改密码
   - 更改密码后，所有已登录设备的 Token 将失效

4. **保护配置文件**
   ```bash
   # 确保配置文件权限正确
   chmod 600 ~/.config/superinbox-cli/config.json
   ```

5. **不要分享配置文件**
   - 配置文件包含登录凭证
   - 不要将配置文件提交到版本控制系统

### 开发者建议

1. **使用环境变量（开发环境）**
   ```bash
   export API_BASE_URL=http://localhost:3001/v1
   ```

2. **不要在脚本中硬编码密码**

3. **使用 CI/CD 环境变量**
   - 在自动化脚本中使用环境变量传递 API Key
   - 不要使用用户账号密码

## 安全事件响应

### 如果 Token 泄露

1. **立即退出登录**
   ```bash
   sinbox logout
   ```

2. **修改密码**
   - 访问 Web 界面修改密码
   - 修改后所有 Token 将失效

3. **检查账户活动**
   - 查看最近的登录记录
   - 检查是否有异常操作

### 如果发现安全漏洞

请通过以下方式报告安全问题：
- 邮箱：security@superinbox.example.com
- 不要在公开 Issue 中披露安全漏洞

## 安全审计记录

| 日期 | 版本 | 审计项 | 结果 |
|------|------|--------|------|
| 2026-01-16 | 0.1.0 | 密码输入安全性 | ✅ 已隐藏 |
| 2026-01-16 | 0.1.0 | 密码存储 | ✅ 不存储 |
| 2026-01-16 | 0.1.0 | 命令行参数传递密码 | ✅ 已禁用 |
| 2026-01-16 | 0.1.0 | Token 存储 | ⚠️ 明文存储 |

## 更新日志

### 2026-01-16
- ✅ 移除命令行参数传递密码的方式
- ✅ 所有密码输入使用交互式 masked input
- ✅ 添加登录状态检查
- ✅ 支持 `sinbox login` 和 `sinbox login <username>` 两种方式

---

**注意**：本文档持续更新，请定期查看最新的安全建议。
