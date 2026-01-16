/**
 * Login Command
 */

import chalk from 'chalk';
import ora from 'ora';
import { api } from '../api/client.js';
import type { LoginRequest } from '../types/index.js';

export async function login(username?: string) {
  // Check if already logged in
  if (api.isLoggedIn()) {
    const user = api.getCurrentUserFromCache();
    console.log(chalk.yellow(`已登录为: ${user?.username} (${user?.email})`));
    console.log(chalk.gray('如需切换账户，请先退出登录: sinbox logout'));
    return;
  }

  let credentials: LoginRequest;

  // Always use interactive prompt for credentials
  const inquirer = (await import('inquirer')).default;

  // If username provided as argument, only prompt for password
  if (username) {
    const answers = await inquirer.prompt([
      {
        type: 'password',
        name: 'password',
        message: '密码:',
        mask: '*',
        validate: (input: string) => input.length > 0 || '请输入密码'
      }
    ]);
    credentials = { username, password: answers.password };
  } else {
    // Prompt for both username and password
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: '用户名:',
        validate: (input: string) => input.length > 0 || '请输入用户名'
      },
      {
        type: 'password',
        name: 'password',
        message: '密码:',
        mask: '*',
        validate: (input: string) => input.length > 0 || '请输入密码'
      }
    ]);
    credentials = answers;
  }

  const spinner = ora('登录中...').start();

  try {
    const { user } = await api.login(credentials);

    spinner.succeed(chalk.green('登录成功!'));
    console.log('');
    console.log(chalk.cyan(`  欢迎, ${user.username}!`));
    console.log(chalk.gray(`  ${user.email}`));
    console.log('');

  } catch (error) {
    spinner.fail(chalk.red('登录失败'));
    if (error instanceof Error) {
      console.log(chalk.red(error.message));
    }
    process.exit(1);
  }
}
