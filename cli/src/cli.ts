#!/usr/bin/env node

/**
 * SuperInbox CLI - Main Entry Point
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { t, getLanguage } from './utils/i18n.js';
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
  .description('SuperInbox CLI - Your intelligent inbox command-line tool')
  .version('0.1.0');

// Add command
program
  .command('add')
  .description(t('commands.add.description'))
  .argument('<content>', getLanguage() === 'zh' ? '要发送的内容' : 'Content to send')
  .option('-t, --type <type>', getLanguage() === 'zh' ? '内容类型 (text, image, url, audio)' : 'Content type (text, image, url, audio)', 'text')
  .option('-s, --source <source>', getLanguage() === 'zh' ? '来源标识' : 'Source identifier', 'cli')
  .option('-w, --wait', getLanguage() === 'zh' ? '等待 AI 处理完成并显示结果' : 'Wait for AI processing to complete')
  .action(async (content, options) => {
    await add(content, options);
  });

// Edit command
program
  .command('edit')
  .description(getLanguage() === 'zh' ? '打开编辑器输入内容' : 'Open editor to input content')
  .option('-t, --type <type>', getLanguage() === 'zh' ? '内容类型' : 'Content type', 'text')
  .option('-s, --source <source>', getLanguage() === 'zh' ? '来源标识' : 'Source identifier', 'cli')
  .option('-w, --wait', getLanguage() === 'zh' ? '等待 AI 处理完成' : 'Wait for AI processing')
  .action(async (options) => {
    await edit(options);
  });

// List command
program
  .command('list')
  .description(t('commands.list.description'))
  .alias('ls')
  .option('-n, --limit <number>', getLanguage() === 'zh' ? '显示数量' : 'Display limit', '20')
  .option('-o, --offset <number>', getLanguage() === 'zh' ? '偏移量' : 'Offset')
  .option('--intent <intent>', getLanguage() === 'zh' ? '按意图筛选 (todo, idea, expense, note, bookmark, schedule)' : 'Filter by intent')
  .option('--status <status>', getLanguage() === 'zh' ? '按状态筛选 (pending, processing, completed, failed)' : 'Filter by status')
  .option('--source <source>', getLanguage() === 'zh' ? '按来源筛选' : 'Filter by source')
  .option('-j, --json', getLanguage() === 'zh' ? '以 JSON 格式输出' : 'Output in JSON format')
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
  .description(t('commands.show.description'))
  .argument('[id]', getLanguage() === 'zh' ? '条目 ID (不提供则从列表中选择)' : 'Item ID (select from list if not provided)')
  .action(async (id) => {
    await show(id);
  });

// Delete command
program
  .command('delete')
  .alias('rm')
  .description(t('commands.delete.description'))
  .argument('[id]', getLanguage() === 'zh' ? '条目 ID (不提供则从列表中选择)' : 'Item ID (select from list if not provided)')
  .action(async (id) => {
    await deleteItem(id);
  });

// Status command
program
  .command('status')
  .description(t('commands.status.description'))
  .action(async () => {
    await status();
  });

// Config command
program
  .command('config')
  .description(t('commands.config.description'))
  .action(async () => {
    await configure();
  });

// Login command
program
  .command('login')
  .description(t('commands.login.description'))
  .argument('[username]', getLanguage() === 'zh' ? '用户名（可选，不提供则交互式输入）' : 'Username (optional, interactive prompt if not provided)')
  .action(async (username) => {
    await login(username);
  });

// Logout command
program
  .command('logout')
  .description(t('commands.logout.description'))
  .action(async () => {
    await logout();
  });

// Register command
program
  .command('register')
  .description(t('commands.register.description'))
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
  console.log(chalk.cyan.bold(`  ${t('help.banner')}  `));
  console.log(chalk.gray(`  ${t('help.subtitle')}`));
  console.log('');
  console.log(chalk.gray(`  ${t('help.quickStart')}`));
  console.log(chalk.white('    sinbox add "明天下午3点开会"'));
  console.log(chalk.white('    sinbox list'));
  console.log('');
}
