/**
 * Internationalization (i18n) utility
 */

import { config } from '../config/manager.js';

export type Language = 'en' | 'zh';

interface Translations {
  // Config menu
  config: {
    title: string;
    mainMenu: {
      apiConnection: string;
      defaultValues: string;
      displayPreferences: string;
      behaviorSettings: string;
      viewConfig: string;
      exit: string;
    };
    apiConnection: {
      title: string;
      setBaseUrl: string;
      setTimeout: string;
      resetToDefaults: string;
      back: string;
      baseUrlPrompt: string;
      timeoutPrompt: string;
      resetConfirm: string;
    };
    defaultValues: {
      title: string;
      setSource: string;
      setType: string;
      resetToDefaults: string;
      back: string;
      sourcePrompt: string;
      typePrompt: string;
      resetConfirm: string;
    };
    displayPreferences: {
      title: string;
      setLanguage: string;
      setCompact: string;
      setColor: string;
      setDateFormat: string;
      setMaxItems: string;
      resetToDefaults: string;
      back: string;
      languagePrompt: string;
      compactPrompt: string;
      colorPrompt: string;
      dateFormatPrompt: string;
      maxItemsPrompt: string;
      resetConfirm: string;
    };
    behaviorSettings: {
      title: string;
      setAutoWait: string;
      setConfirmDelete: string;
      resetToDefaults: string;
      back: string;
      autoWaitPrompt: string;
      confirmDeletePrompt: string;
      resetConfirm: string;
    };
    common: {
      success: string;
      cancelled: string;
      invalidValue: string;
      resetSuccess: string;
    };
  };
}

const translations: Record<Language, Translations> = {
  en: {
    config: {
      title: 'SuperInbox CLI Configuration',
      mainMenu: {
        apiConnection: 'API Connection',
        defaultValues: 'Default Values',
        displayPreferences: 'Display Preferences',
        behaviorSettings: 'Behavior Settings',
        viewConfig: 'View Current Config',
        exit: 'Exit',
      },
      apiConnection: {
        title: 'Configure API Connection',
        setBaseUrl: 'Set Base URL',
        setTimeout: 'Set Timeout',
        resetToDefaults: 'Reset API Connection to Defaults',
        back: 'Back to Main Menu',
        baseUrlPrompt: 'Enter API base URL:',
        timeoutPrompt: 'Enter timeout (ms):',
        resetConfirm: 'Reset API connection to defaults?',
      },
      defaultValues: {
        title: 'Configure Default Values',
        setSource: 'Set Default Source',
        setType: 'Set Default Type',
        resetToDefaults: 'Reset Default Values to Defaults',
        back: 'Back to Main Menu',
        sourcePrompt: 'Enter default source:',
        typePrompt: 'Enter default type:',
        resetConfirm: 'Reset default values to defaults?',
      },
      displayPreferences: {
        title: 'Configure Display Preferences',
        setLanguage: 'Set Language',
        setCompact: 'Set Compact Mode',
        setColor: 'Set Color Output',
        setDateFormat: 'Set Date Format',
        setMaxItems: 'Set Max Items to Display',
        resetToDefaults: 'Reset Display Preferences to Defaults',
        back: 'Back to Main Menu',
        languagePrompt: 'Select language:',
        compactPrompt: 'Enable compact mode?',
        colorPrompt: 'Enable color output?',
        dateFormatPrompt: 'Select date format:',
        maxItemsPrompt: 'Enter max items to display:',
        resetConfirm: 'Reset display preferences to defaults?',
      },
      behaviorSettings: {
        title: 'Configure Behavior Settings',
        setAutoWait: 'Set Auto Wait for AI Processing',
        setConfirmDelete: 'Set Confirm Before Delete',
        resetToDefaults: 'Reset Behavior Settings to Defaults',
        back: 'Back to Main Menu',
        autoWaitPrompt: 'Auto wait for AI processing after adding items?',
        confirmDeletePrompt: 'Confirm before deleting items?',
        resetConfirm: 'Reset behavior settings to defaults?',
      },
      common: {
        success: 'Configuration updated successfully',
        cancelled: 'Operation cancelled',
        invalidValue: 'Invalid value',
        resetSuccess: 'Settings reset to defaults',
      },
    },
  },
  zh: {
    config: {
      title: 'SuperInbox CLI 配置',
      mainMenu: {
        apiConnection: 'API 连接',
        defaultValues: '默认值',
        displayPreferences: '显示偏好',
        behaviorSettings: '行为设置',
        viewConfig: '查看当前配置',
        exit: '退出',
      },
      apiConnection: {
        title: '配置 API 连接',
        setBaseUrl: '设置 API 地址',
        setTimeout: '设置超时时间',
        resetToDefaults: '恢复 API 连接默认值',
        back: '返回主菜单',
        baseUrlPrompt: '请输入 API 地址:',
        timeoutPrompt: '请输入超时时间 (毫秒):',
        resetConfirm: '是否恢复 API 连接默认值？',
      },
      defaultValues: {
        title: '配置默认值',
        setSource: '设置默认来源',
        setType: '设置默认类型',
        resetToDefaults: '恢复默认值',
        back: '返回主菜单',
        sourcePrompt: '请输入默认来源:',
        typePrompt: '请输入默认类型:',
        resetConfirm: '是否恢复默认值？',
      },
      displayPreferences: {
        title: '配置显示偏好',
        setLanguage: '设置语言',
        setCompact: '设置紧凑模式',
        setColor: '设置彩色输出',
        setDateFormat: '设置日期格式',
        setMaxItems: '设置最大显示条目数',
        resetToDefaults: '恢复显示偏好默认值',
        back: '返回主菜单',
        languagePrompt: '选择语言:',
        compactPrompt: '是否启用紧凑模式？',
        colorPrompt: '是否启用彩色输出？',
        dateFormatPrompt: '选择日期格式:',
        maxItemsPrompt: '请输入最大显示条目数:',
        resetConfirm: '是否恢复显示偏好默认值？',
      },
      behaviorSettings: {
        title: '配置行为设置',
        setAutoWait: '设置自动等待 AI 处理',
        setConfirmDelete: '设置删除前确认',
        resetToDefaults: '恢复行为设置默认值',
        back: '返回主菜单',
        autoWaitPrompt: '添加条目后自动等待 AI 处理？',
        confirmDeletePrompt: '删除条目前需要确认？',
        resetConfirm: '是否恢复行为设置默认值？',
      },
      common: {
        success: '配置更新成功',
        cancelled: '操作已取消',
        invalidValue: '无效的值',
        resetSuccess: '设置已恢复默认值',
      },
    },
  },
};

export function getLanguage(): Language {
  const lang = config.get().display?.language;
  return (lang === 'zh' || lang === 'en') ? lang : 'en';
}

export function t(key: string): string {
  const lang = getLanguage();
  const keys = key.split('.');
  let value: any = translations[lang];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return key if translation not found
    }
  }

  return typeof value === 'string' ? value : key;
}
