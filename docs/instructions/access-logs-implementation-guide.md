# 访问日志系统实施启动指南

**目标：** 在新会话中使用 `superpowers:executing-plans` 批量实施访问日志与审计系统

---

## 🚀 快速启动

### 步骤 1：进入 Worktree

```bash
cd ~/.config/superpowers/worktrees/SuperInbox/access-logs-v2
```

### 步骤 2：启动新 Claude Code 会话

在新终端中：

```bash
# 方式 A: 如果使用 VSCode 插件
# 直接在 VSCode 中开始新对话

# 方式 B: 如果使用 CLI
cd ~/.config/superpowers/worktrees/SuperInbox/access-logs-v2
claude  # 或你的启动命令
```

### 步骤 3：在会话开始时执行

在第一条消息中输入：

```
/superpowers:executing-plans

我需要实施访问日志与审计系统。

实施计划：docs/plans/2026-01-17-access-logs-implementation.md

请按照计划逐步执行，每个 Phase 完成后暂停等待我的确认。
```

---

## 📋 实施清单

### Phase 1: 基础架构与类型定义 (2-3 hours)
- [ ] Task 1: 创建日志类型定义
- [ ] Task 2: 创建日志 API 客户端
- [ ] Task 3: 创建筛选器管理 Hook

### Phase 2: UI 组件实现 (4-5 hours)
- [ ] Task 4: 创建日志筛选器组件
- [ ] Task 5: 创建日志表格组件
- [ ] Task 6: 创建分页组件

### Phase 3: 页面实现 (2-3 hours)
- [ ] Task 7: 创建全局日志页面
- [ ] Task 8: 创建单个 Key 的日志页面

### Phase 4: 导出功能 (2 hours)
- [ ] Task 9: 创建导出对话框组件

### Phase 5: 集成与优化 (1-2 hours)
- [ ] Task 10: 更新侧边栏导航
- [ ] Task 11: 添加工具函数
- [ ] Task 12: 错误处理和加载状态

### Phase 6: 测试与验证 (1-2 hours)
- [ ] Task 13: 手动测试清单

### Phase 7: 文档与收尾 (30 minutes)
- [ ] Task 14: 更新项目文档
- [ ] Task 15: 创建功能总结

---

## 💡 重要提示

### 对实施 Agent 的指令

在每个 Phase 开始前，明确告诉 agent：

```
请执行 Phase [X]：[Phase 名称]

严格按照 docs/plans/2026-01-17-access-logs-implementation.md 中的步骤执行。

每个 Task 完成后：
1. 运行代码检查（TypeScript/ESLint）
2. 提交代码
3. 向我报告完成状态

等待我的确认后再继续下一个 Phase。
```

### 检查点设置

建议在每个 Phase 后设置检查点：
- ✅ Phase 1 完成后：类型定义和 API 客户端就绪
- ✅ Phase 2 完成后：所有 UI 组件就绪
- ✅ Phase 3 完成后：页面可以访问
- ✅ Phase 4 完成后：导出功能就绪
- ✅ Phase 5 完成后：集成完成，可以测试

### 常见问题处理

**问题 1：组件未找到**
```
错误：Cannot find module '@/components/ui/xxx'
解决：确认 shadcn/ui 组件已安装，参考 web/components.json
```

**问题 2：API 路径错误**
```
错误：404 Not Found on /auth/logs
解决：确认后端 API 已实现，检查 backend/src/auth/controllers/
```

**问题 3：权限检查失败**
```
错误：权限不足提示
解决：测试时手动修改 Token，添加 admin:full scope
```

---

## 🎯 完成标准

### 功能验收

- [ ] 可以访问 `/settings/logs` 页面
- [ ] 可以看到日志列表
- [ ] 筛选器功能正常
- [ ] 点击展开显示详情
- [ ] 导出功能正常

### 代码质量

- [ ] TypeScript 类型检查通过
- [ ] ESLint 检查通过
- [ ] 所有代码已提交到 feature/access-logs-v2 分支
- [ ] Commit 信息清晰规范

---

## 📦 完成后的清理

### 使用 finishing-a-development-branch 技能

实施完成后，在主会话中：

```
/superpowers:finishing-a-development-branch

分支：feature/access-logs-v2
工作区：~/.config/superpowers/worktrees/SuperInbox/access-logs-v2
```

该技能会帮你：
1. 代码审查
2. 合并到 main 分支
3. 清理 worktree
4. 推送更改

---

## 📚 相关文档

- **实施计划：** `docs/plans/2026-01-17-access-logs-implementation.md`
- **设计文档：** `docs/designs/2026-01-17-access-logs-system-design.md`
- **视觉原型：** `docs/designs/access-logs-wireframe.html`
- **API 文档：** `SuperInbox-Core-API文档.md` (第 8 章)

---

## ✨ 准备好了吗？

现在可以：
1. ✅ 关闭当前会话
2. ✅ 打开新会话
3. ✅ 使用 `/superpowers:executing-plans` 开始实施

祝实施顺利！🚀
