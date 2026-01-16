/**
 * Login Command
 */

import chalk from 'chalk';
import ora from 'ora';
import { api } from '../api/client.js';
import { t } from '../utils/i18n.js';
import type { LoginRequest } from '../types/index.js';

export async function login(username?: string) {
  // Check if already logged in
  if (api.isLoggedIn()) {
    const user = api.getCurrentUserFromCache();
    console.log(chalk.yellow(`${t('commands.login.alreadyLoggedIn')}: ${user?.username} (${user?.email})`));
    console.log(chalk.gray(t('commands.login.switchAccount')));
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
        message: t('commands.login.passwordPrompt'),
        mask: '*',
        validate: (input: string) => input.length > 0 || t('commands.login.passwordRequired')
      }
    ]);
    credentials = { username, password: answers.password };
  } else {
    // Prompt for both username and password
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: t('commands.login.usernamePrompt'),
        validate: (input: string) => input.length > 0 || t('commands.login.usernameRequired')
      },
      {
        type: 'password',
        name: 'password',
        message: t('commands.login.passwordPrompt'),
        mask: '*',
        validate: (input: string) => input.length > 0 || t('commands.login.passwordRequired')
      }
    ]);
    credentials = answers;
  }

  const spinner = ora(t('commands.login.loggingIn')).start();

  try {
    const { user } = await api.login(credentials);

    spinner.succeed(chalk.green(t('commands.login.success')));
    console.log('');
    console.log(chalk.cyan(`  ${t('commands.login.welcome')}, ${user.username}!`));
    console.log(chalk.gray(`  ${user.email}`));
    console.log('');

  } catch (error) {
    spinner.fail(chalk.red(t('commands.login.failed')));
    if (error instanceof Error) {
      console.log(chalk.red(error.message));
    }
    process.exit(1);
  }
}
