/**
 * Status Command - Check server status
 */

import chalk from 'chalk';
import ora from 'ora';
import { api } from '../api/client.js';
import { config } from '../config/manager.js';
import { display } from '../utils/display.js';

export async function status(): Promise<void> {
  const spinner = ora('Checking server status...').start();

  try {
    const health = await api.healthCheck();
    spinner.succeed('Server is running');

    console.log('');
    console.log(chalk.gray('Version:  ') + chalk.white(health.version));
    console.log(chalk.gray('Status:   ') + chalk.green(health.status));
    console.log(chalk.gray('Endpoint: ') + chalk.cyan(config.get().api.baseUrl));
    console.log('');

  } catch (error) {
    spinner.fail('Server check failed');
    display.error(error instanceof Error ? error.message : 'Cannot connect to server');
    process.exit(1);
  }
}
