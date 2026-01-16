#!/usr/bin/env node

/**
 * SuperInbox CLI - Main Entry Point
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { add } from './commands/add.js';
import { list } from './commands/list.js';
import { show } from './commands/show.js';
import { edit } from './commands/edit.js';
import { deleteItem } from './commands/delete.js';
import { status } from './commands/status.js';
import { configure } from './commands/configure.js';
import { login } from './commands/login.js';
import { logout } from './commands/logout.js';
import { register } from './commands/register.js';

const program = new Command();

// CLI info
program
  .name('sinbox')
  .description('SuperInbox CLI - 你的智能收件箱命令行工具')
  .version('0.1.0');

// Add command
program
  .command('add')
  .description('发送内容到收件箱')
  .argument('<content>', '要发送的内容')
  .option('-t, --type <type>', '内容类型 (text, image, url, audio)', 'text')
  .option('-s, --source <source>', '来源标识', 'cli')
  .option('-w, --wait', '等待 AI 处理完成并显示结果')
  .action(async (content, options) => {
    await add(content, options);
  });

// Edit command
program
  .command('edit')
  .description('打开编辑器输入内容')
  .option('-t, --type <type>', '内容类型', 'text')
  .option('-s, --source <source>', '来源标识', 'cli')
  .option('-w, --wait', '等待 AI 处理完成')
  .action(async (options) => {
    await edit(options);
  });

// List command
program
  .command('list')
  .description('查看条目列表')
  .alias('ls')
  .option('-n, --limit <number>', '显示数量', '20')
  .option('-o, --offset <number>', '偏移量')
  .option('--intent <intent>', '按意图筛选 (todo, idea, expense, note, bookmark, schedule)')
  .option('--status <status>', '按状态筛选 (pending, processing, completed, failed)')
  .option('--source <source>', '按来源筛选')
  .option('-j, --json', '以 JSON 格式输出')
  .action(async (options) => {
    await list({
      limit: parseInt(options.limit),
      offset: options.offset ? parseInt(options.offset) : undefined,
      intent: options.intent,
      status: options.status,
      source: options.source,
      json: options.json
    });
  });

// Show command
program
  .command('show')
  .description('查看条目详情')
  .argument('[id]', '条目 ID (不提供则从列表中选择)')
  .action(async (id) => {
    await show(id);
  });

// Delete command
program
  .command('delete')
  .alias('rm')
  .description('删除条目')
  .argument('[id]', '条目 ID (不提供则从列表中选择)')
  .action(async (id) => {
    await deleteItem(id);
  });

// Status command
program
  .command('status')
  .description('查看服务状态')
  .action(async () => {
    await status();
  });

// Config command
program
  .command('config')
  .description('管理配置')
  .argument('<action>', '操作: get, set, reset')
  .argument('[key]', '配置键')
  .argument('[value]', '配置值')
  .action(async (action, key, value) => {
    await configure(action, key, value);
  });

// Login command
program
  .command('login')
  .description('登录账户')
  .argument('[username]', '用户名（可选，不提供则交互式输入）')
  .action(async (username) => {
    await login(username);
  });

// Logout command
program
  .command('logout')
  .description('退出登录')
  .action(async () => {
    await logout();
  });

// Register command
program
  .command('register')
  .description('注册新账户（在网页中完成）')
  .action(async () => {
    await register();
  });

// Parse arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

// Banner on startup (only for certain commands)
const command = process.argv[2];
if (!command || command === 'help' || command === '--help' || command === '-h') {
  console.log('');
  console.log(chalk.cyan.bold('  SuperInbox CLI  '));
  console.log(chalk.gray('  智能收件箱命令行工具'));
  console.log('');
  console.log(chalk.gray('  快速开始:'));
  console.log(chalk.white('    sinbox add "明天下午3点开会"'));
  console.log(chalk.white('    sinbox list'));
  console.log('');
}
