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
          { name: t('config.mainMenu.displayPreferences'), value: 'display' },
          { name: t('config.mainMenu.behaviorSettings'), value: 'behavior' },
          { name: t('config.mainMenu.viewConfig'), value: 'view' },
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
      case 'display':
        await configureDisplayPreferences();
        break;
      case 'behavior':
        await configureBehaviorSettings();
        break;
      case 'view':
        display.config(config.get());
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
          { name: t('config.defaultValues.setType'), value: 'type' },
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
      case 'type': {
        const { value } = await inquirer.prompt([
          {
            type: 'list',
            name: 'value',
            message: t('config.defaultValues.typePrompt'),
            default: config.get().defaults.type,
            choices: ['text', 'image', 'url', 'audio', 'file'],
          },
        ]);
        config.set('defaults.type', value);
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
          config.set('defaults.type', 'text');
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

async function configureDisplayPreferences(): Promise<void> {
  let back = false;

  while (!back) {
    console.log('');
    console.log(chalk.cyan(`  ${t('config.displayPreferences.title')}  `));
    console.log('');

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: t('config.displayPreferences.title'),
        choices: [
          { name: t('config.displayPreferences.setCompact'), value: 'compact' },
          { name: t('config.displayPreferences.setColor'), value: 'color' },
          { name: t('config.displayPreferences.setDateFormat'), value: 'dateFormat' },
          { name: t('config.displayPreferences.setMaxItems'), value: 'maxItems' },
          { name: t('config.displayPreferences.resetToDefaults'), value: 'reset' },
          { name: t('config.displayPreferences.back'), value: 'back' },
        ],
      },
    ]);

    switch (action) {
      case 'compact': {
        const { value } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'value',
            message: t('config.displayPreferences.compactPrompt'),
            default: config.get().display.compact,
          },
        ]);
        config.set('display.compact', value);
        display.success(t('config.common.success'));
        break;
      }
      case 'color': {
        const { value } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'value',
            message: t('config.displayPreferences.colorPrompt'),
            default: config.get().display.color,
          },
        ]);
        config.set('display.color', value);
        display.success(t('config.common.success'));
        break;
      }
      case 'dateFormat': {
        const { value } = await inquirer.prompt([
          {
            type: 'list',
            name: 'value',
            message: t('config.displayPreferences.dateFormatPrompt'),
            default: config.get().display.dateFormat,
            choices: [
              { name: 'Relative (e.g., "2 hours ago")', value: 'relative' },
              { name: 'Absolute (e.g., "2024-01-16 14:30")', value: 'absolute' },
            ],
          },
        ]);
        config.set('display.dateFormat', value);
        display.success(t('config.common.success'));
        break;
      }
      case 'maxItems': {
        const { value } = await inquirer.prompt([
          {
            type: 'number',
            name: 'value',
            message: t('config.displayPreferences.maxItemsPrompt'),
            default: config.get().display.maxItems,
            validate: (input: number) => input > 0 || t('config.common.invalidValue'),
          },
        ]);
        config.set('display.maxItems', value);
        display.success(t('config.common.success'));
        break;
      }
      case 'reset': {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: t('config.displayPreferences.resetConfirm'),
            default: false,
          },
        ]);
        if (confirm) {
          config.set('display.language', 'en');
          config.set('display.compact', false);
          config.set('display.color', true);
          config.set('display.dateFormat', 'relative');
          config.set('display.maxItems', 20);
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

async function configureBehaviorSettings(): Promise<void> {
  let back = false;

  while (!back) {
    console.log('');
    console.log(chalk.cyan(`  ${t('config.behaviorSettings.title')}  `));
    console.log('');

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: t('config.behaviorSettings.title'),
        choices: [
          { name: t('config.behaviorSettings.setAutoWait'), value: 'autoWait' },
          { name: t('config.behaviorSettings.setConfirmDelete'), value: 'confirmDelete' },
          { name: t('config.behaviorSettings.resetToDefaults'), value: 'reset' },
          { name: t('config.behaviorSettings.back'), value: 'back' },
        ],
      },
    ]);

    switch (action) {
      case 'autoWait': {
        const { value } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'value',
            message: t('config.behaviorSettings.autoWaitPrompt'),
            default: config.get().behavior.autoWait,
          },
        ]);
        config.set('behavior.autoWait', value);
        display.success(t('config.common.success'));
        break;
      }
      case 'confirmDelete': {
        const { value } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'value',
            message: t('config.behaviorSettings.confirmDeletePrompt'),
            default: config.get().behavior.confirmDelete,
          },
        ]);
        config.set('behavior.confirmDelete', value);
        display.success(t('config.common.success'));
        break;
      }
      case 'reset': {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: t('config.behaviorSettings.resetConfirm'),
            default: false,
          },
        ]);
        if (confirm) {
          config.set('behavior.autoWait', false);
          config.set('behavior.confirmDelete', true);
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
