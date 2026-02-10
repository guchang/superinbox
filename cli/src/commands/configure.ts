/**
 * Configure Command - Interactive configuration wizard
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { config } from '../config/manager.js';
import { display } from '../utils/display.js';
import { t } from '../utils/i18n.js';

export async function configure(): Promise<void> {
  let exit = false;

  while (!exit) {
    console.log('');
    console.log(chalk.cyan.bold(`  ${t('config.title')}  `));
    console.log('');

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: t('config.title'),
        choices: [
          { name: t('config.mainMenu.language'), value: 'language' },
          { name: t('config.mainMenu.apiConnection'), value: 'api' },
          { name: t('config.mainMenu.defaultValues'), value: 'defaults' },
          { name: t('config.mainMenu.exit'), value: 'exit' },
        ],
      },
    ]);

    switch (action) {
      case 'language':
        await configureLanguage();
        break;
      case 'api':
        await configureApiConnection();
        break;
      case 'defaults':
        await configureDefaultValues();
        break;
      case 'exit':
        exit = true;
        break;
    }
  }
}

async function configureLanguage(): Promise<void> {
  const { value } = await inquirer.prompt([
    {
      type: 'list',
      name: 'value',
      message: t('config.language.prompt'),
      default: config.get().display.language,
      choices: [
        { name: 'English', value: 'en' },
        { name: '中文', value: 'zh' },
      ],
    },
  ]);
  config.set('display.language', value);
  display.success(t('config.common.success'));
}

async function configureApiConnection(): Promise<void> {
  let back = false;

  while (!back) {
    console.log('');
    console.log(chalk.cyan(`  ${t('config.apiConnection.title')}  `));
    console.log('');

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: t('config.apiConnection.title'),
        choices: [
          { name: t('config.apiConnection.setBaseUrl'), value: 'baseUrl' },
          { name: t('config.apiConnection.setTimeout'), value: 'timeout' },
          { name: t('config.apiConnection.resetToDefaults'), value: 'reset' },
          { name: t('config.apiConnection.back'), value: 'back' },
        ],
      },
    ]);

    switch (action) {
      case 'baseUrl': {
        const { value } = await inquirer.prompt([
          {
            type: 'input',
            name: 'value',
            message: t('config.apiConnection.baseUrlPrompt'),
            default: config.get().api.baseUrl,
            validate: (input: string) => {
              try {
                new URL(input);
                return true;
              } catch {
                return t('config.common.invalidValue');
              }
            },
          },
        ]);
        config.set('api.baseUrl', value);
        display.success(t('config.common.success'));
        break;
      }
      case 'timeout': {
        const { value } = await inquirer.prompt([
          {
            type: 'number',
            name: 'value',
            message: t('config.apiConnection.timeoutPrompt'),
            default: config.get().api.timeout,
            validate: (input: number) => input > 0 || t('config.common.invalidValue'),
          },
        ]);
        config.set('api.timeout', value);
        display.success(t('config.common.success'));
        break;
      }
      case 'reset': {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: t('config.apiConnection.resetConfirm'),
            default: false,
          },
        ]);
        if (confirm) {
          config.set('api.baseUrl', 'http://localhost:3001/v1');
          config.set('api.timeout', 30000);
          display.success(t('config.common.resetSuccess'));
        } else {
          display.info(t('config.common.cancelled'));
        }
        break;
      }
      case 'back':
        back = true;
        break;
    }
  }
}

async function configureDefaultValues(): Promise<void> {
  let back = false;

  while (!back) {
    console.log('');
    console.log(chalk.cyan(`  ${t('config.defaultValues.title')}  `));
    console.log('');

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: t('config.defaultValues.title'),
        choices: [
          { name: t('config.defaultValues.setSource'), value: 'source' },
          { name: t('config.defaultValues.resetToDefaults'), value: 'reset' },
          { name: t('config.defaultValues.back'), value: 'back' },
        ],
      },
    ]);

    switch (action) {
      case 'source': {
        const { value } = await inquirer.prompt([
          {
            type: 'input',
            name: 'value',
            message: t('config.defaultValues.sourcePrompt'),
            default: config.get().defaults.source,
          },
        ]);
        config.set('defaults.source', value);
        display.success(t('config.common.success'));
        break;
      }
      case 'reset': {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: t('config.defaultValues.resetConfirm'),
            default: false,
          },
        ]);
        if (confirm) {
          config.set('defaults.source', 'cli');
          display.success(t('config.common.resetSuccess'));
        } else {
          display.info(t('config.common.cancelled'));
        }
        break;
      }
      case 'back':
        back = true;
        break;
    }
  }
}
