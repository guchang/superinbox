# 登录功能测试指南

## 前提条件

1. 确保后端服务已启动并实现了认证接口
2. 确保前端服务正在运行（http://localhost:3000）

## 测试步骤

### 1. 测试注册功能
1. 访问 http://localhost:3000/register
2. 填写注册表单：
   - 用户名：至少 3 位
   - 邮箱：有效的邮箱格式
   - 密码：至少 6 位
   - 确认密码：必须与密码一致
3. 点击"注册"按钮
4. **预期结果**：
   - 注册成功后自动跳转到首页
   - 显示"注册成功"提示
   - 右上角用户图标显示注册的用户名

### 2. 测试登录功能
1. 访问 http://localhost:3000/login
2. 输入已注册的用户名和密码
3. 点击"登录"按钮
4. **预期结果**：
   - 登录成功后自动跳转到首页
   - 显示"登录成功"提示
   - 右上角用户图标显示用户名

### 3. 测试路由保护
1. 清除浏览器的 localStorage 和 cookie
2. 直接访问 http://localhost:3000/
3. **预期结果**：
   - 自动重定向到登录页 http://localhost:3000/login

4. 登录后访问 http://localhost:3000/login
5. **预期结果**：
   - 自动重定向到首页 http://localhost:3000/

### 4. 测试登出功能
1. 登录后点击右上角用户图标
2. 在下拉菜单中点击"退出登录"
3. **预期结果**：
   - 显示"已退出登录"提示
   - 自动重定向到登录页
   - localStorage 中的认证数据被清除

### 5. 测试表单验证
1. 访问注册页面
2. 尝试提交空表单
3. **预期结果**：
   - 显示验证错误提示
   - 无法提交表单

4. 尝试输入不匹配的密码
5. **预期结果**：
   - 显示"两次输入的密码不一致"错误

### 6. 测试 Token 持久化
1. 登录后刷新页面
2. **预期结果**：
   - 仍然保持登录状态
   - 不需要重新登录

3. 关闭浏览器标签页，重新打开
4. **预期结果**：
   - 仍然保持登录状态

## 调试技巧

### 查看 localStorage
在浏览器控制台执行：
```javascript
localStorage.getItem('superinbox_auth_token')
localStorage.getItem('superinbox_user')
```

### 查看 Cookie
在浏览器控制台执行：
```javascript
document.cookie
```

### 查看认证状态
在浏览器控制台执行：
```javascript
// 在任何页面中
window.location.href = 'http://localhost:3000'
```

### 清除认证数据
在浏览器控制台执行：
```javascript
localStorage.clear()
document.cookie.split(";").forEach(c => document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"))
location.reload()
```

## 常见问题

### Q: 登录后仍然重定向到登录页
A: 检查后端是否正确设置了 Cookie，Cookie 的 `httpOnly` 应该为 `false`

### Q: 提示 401 错误
A: 检查后端 API 是否正确实现了 `/v1/auth/login` 接口

### Q: 中间件不工作
A: 检查 Next.js 版本是否为 15+，确保 middleware.ts 文件在项目根目录

### Q: 表单验证不生效
A: 检查是否安装了 @hookform/resolvers 和 zod

## 后端 API 检查清单

- [ ] POST /v1/auth/login - 返回 `{ success: true, data: { user, token, refreshToken } }`
- [ ] POST /v1/auth/register - 返回 `{ success: true, data: { user, token, refreshToken } }`
- [ ] POST /v1/auth/logout - 返回 `{ success: true }`
- [ ] GET /v1/auth/me - 返回 `{ success: true, data: { user } }`
- [ ] POST /v1/auth/refresh - 返回 `{ success: true, data: { user, token, refreshToken } }`
- [ ] 所有需要认证的接口都检查 `Authorization: Bearer {token}` 头
- [ ] 登录/注册成功后设置 Cookie：
  - `superinbox_auth_token`
  - `superinbox_refresh_token` (可选)
  - `superinbox_user` (可选，JSON 字符串)

## 手动测试 API

使用 curl 测试登录接口：
```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"123456"}'
```

使用 curl 测试受保护的接口：
```bash
curl -X GET http://localhost:3000/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
