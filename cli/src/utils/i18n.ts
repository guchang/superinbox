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
      language: string;
      apiConnection: string;
      defaultValues: string;
      exit: string;
    };
    language: {
      prompt: string;
    };
    apiConnection: {
      title: string;
      setApiBaseUrl: string;
      setWebBaseUrl: string;
      setTimeout: string;
      resetToDefaults: string;
      back: string;
      apiBaseUrlPrompt: string;
      webBaseUrlPrompt: string;
      timeoutPrompt: string;
      resetConfirm: string;
      apiBaseUrlInvalid: string;
      webBaseUrlInvalid: string;
    };
    defaultValues: {
      title: string;
      setSource: string;
      resetToDefaults: string;
      back: string;
      sourcePrompt: string;
      resetConfirm: string;
    };
    common: {
      success: string;
      cancelled: string;
      invalidValue: string;
      resetSuccess: string;
    };
  };
  // CLI commands
  commands: {
    add: {
      description: string;
      sending: string;
      created: string;
      waiting: string;
      complete: string;
      failed: string;
      timeout: string;
    };
    list: {
      description: string;
      empty: string;
      total: string;
      pageInfo: string;
      selectAction: string;
      viewDetails: string;
      deleteItem: string;
      prevPage: string;
      nextPage: string;
      gotoPage: string;
      gotoPrompt: string;
      invalidPage: string;
      noPrevPage: string;
      noNextPage: string;
      refresh: string;
      exit: string;
      selectItem: string;
      selectToDelete: string;
      refreshing: string;
      exiting: string;
    };
    show: {
      description: string;
      empty: string;
      selectItem: string;
      selectAction: string;
      edit: string;
      delete: string;
      backToList: string;
      exit: string;
      editInProgress: string;
    };
    delete: {
      description: string;
      empty: string;
      selectItem: string;
      confirmTitle: string;
      confirm: string;
      deleting: string;
      success: string;
      cancelled: string;
      selectAction: string;
      backToList: string;
      continueDelete: string;
      exit: string;
      continuePrompt: string;
    };
    login: {
      description: string;
      alreadyLoggedIn: string;
      switchAccount: string;
      usernamePrompt: string;
      passwordPrompt: string;
      usernameRequired: string;
      passwordRequired: string;
      loggingIn: string;
      success: string;
      welcome: string;
      failed: string;
    };
    logout: {
      description: string;
      confirm: string;
      loggingOut: string;
      success: string;
      failed: string;
    };
    status: {
      description: string;
      checking: string;
      running: string;
      failed: string;
      version: string;
      status: string;
      endpoint: string;
      user: string;
      notLoggedIn: string;
    };
    register: {
      description: string;
      title: string;
      alreadyLoggedIn: string;
      logoutFirst: string;
      instructions: string;
      openBrowser: string;
      afterRegister: string;
      loginCommand: string;
      webBaseUrlRequired: string;
    };
    config: {
      description: string;
    };
    auth: {
      required: string;
      loginPrompt: string;
    };
  };
  // Help text
  help: {
    banner: string;
    subtitle: string;
    quickStart: string;
  };
}

const translations: Record<Language, Translations> = {
  en: {
    config: {
      title: 'SuperInbox CLI Configuration',
      mainMenu: {
        language: 'Language / 语言',
        apiConnection: 'API Connection',
        defaultValues: 'Default Values',
        exit: 'Exit',
      },
      language: {
        prompt: 'Select language:',
      },
      apiConnection: {
        title: 'Configure API/Web Connection',
        setApiBaseUrl: 'Set Backend API URL (/v1)',
        setWebBaseUrl: 'Set Frontend Web URL',
        setTimeout: 'Set Timeout',
        resetToDefaults: 'Clear API/Web URL Configuration',
        back: 'Back to Main Menu',
        apiBaseUrlPrompt: 'Enter backend API base URL (must include /v1):',
        webBaseUrlPrompt: 'Enter frontend web base URL (protocol + host + port):',
        timeoutPrompt: 'Enter timeout (ms):',
        resetConfirm: 'Clear backend/frontend URL configuration?',
        apiBaseUrlInvalid: 'Invalid backend API URL. Example: http://localhost:3001/v1',
        webBaseUrlInvalid: 'Invalid frontend web URL. Example: http://localhost:3000',
      },
      defaultValues: {
        title: 'Configure Default Values',
        setSource: 'Set Default Source',
        resetToDefaults: 'Reset Default Values to Defaults',
        back: 'Back to Main Menu',
        sourcePrompt: 'Enter default source:',
        resetConfirm: 'Reset default values to defaults?',
      },
      common: {
        success: 'Configuration updated successfully',
        cancelled: 'Operation cancelled',
        invalidValue: 'Invalid value',
        resetSuccess: 'Settings reset to defaults',
      },
    },
    commands: {
      add: {
        description: 'Send content to inbox',
        sending: 'Sending to inbox...',
        created: 'Item created',
        waiting: 'Waiting for AI processing...',
        complete: 'AI processing complete',
        failed: 'AI processing failed',
        timeout: 'AI processing timeout',
      },
      list: {
        description: 'List all items',
        empty: 'No items found',
        total: 'Total',
        pageInfo: 'Page',
        selectAction: 'Select action:',
        viewDetails: 'View details',
        deleteItem: 'Delete item',
        prevPage: 'Previous page',
        nextPage: 'Next page',
        gotoPage: 'Go to page',
        gotoPrompt: 'Enter page number:',
        invalidPage: 'Invalid page number',
        noPrevPage: 'Already at the first page',
        noNextPage: 'Already at the last page',
        refresh: 'Refresh list',
        exit: 'Exit',
        selectItem: 'Select an item to view:',
        selectToDelete: 'Select an item to delete:',
        refreshing: 'Refreshing...',
        exiting: 'Exiting',
      },
      show: {
        description: 'View item details',
        empty: 'No items found',
        selectItem: 'Select an item to view:',
        selectAction: 'Select action:',
        edit: 'Edit item',
        delete: 'Delete item',
        backToList: 'Back to list',
        exit: 'Exit',
        editInProgress: 'Edit feature in development...',
      },
      delete: {
        description: 'Delete an item',
        empty: 'No items to delete',
        selectItem: 'Select an item to delete:',
        confirmTitle: 'Delete confirmation',
        confirm: 'Are you sure you want to delete this item?',
        deleting: 'Deleting...',
        success: 'Deleted successfully',
        cancelled: 'Deletion cancelled',
        selectAction: 'Select action:',
        backToList: 'Back to list',
        continueDelete: 'Continue deleting',
        exit: 'Exit',
        continuePrompt: 'Continue deleting other items?',
      },
      login: {
        description: 'Login to your account',
        alreadyLoggedIn: 'Already logged in as',
        switchAccount: 'Switch to another account now?',
        usernamePrompt: 'Username:',
        passwordPrompt: 'Password:',
        usernameRequired: 'Please enter username',
        passwordRequired: 'Please enter password',
        loggingIn: 'Logging in...',
        success: 'Login successful!',
        welcome: 'Welcome',
        failed: 'Login failed',
      },
      logout: {
        description: 'Logout from your account',
        confirm: 'Are you sure you want to logout?',
        loggingOut: 'Logging out...',
        success: 'Logout successful',
        failed: 'Logout failed',
      },
      status: {
        description: 'Check server status',
        checking: 'Checking server status...',
        running: 'Server is running',
        failed: 'Server check failed',
        version: 'Version',
        status: 'Status',
        endpoint: 'Endpoint',
        user: 'User',
        notLoggedIn: 'Not logged in',
      },
      register: {
        description: 'Register a new account (in web browser)',
        title: 'SuperInbox Registration',
        alreadyLoggedIn: 'Already logged in as',
        logoutFirst: 'To register a new account, please logout first: sinbox logout',
        instructions: 'Please open the following link in your browser to complete registration:',
        openBrowser: 'Open in browser',
        afterRegister: 'After registration, use the following command to login:',
        loginCommand: 'sinbox login <username>',
        webBaseUrlRequired: 'Frontend Web URL is not configured. Please run: sinbox config -> API Connection -> Set Frontend Web URL',
      },
      config: {
        description: 'Interactive configuration wizard',
      },
      auth: {
        required: 'Authentication required',
        loginPrompt: 'Please use the following command to login:',
      },
    },
    help: {
      banner: 'SuperInbox CLI',
      subtitle: 'Your intelligent inbox command-line tool',
      quickStart: 'Quick Start:',
    },
  },
  zh: {
    config: {
      title: 'SuperInbox CLI 配置',
      mainMenu: {
        language: 'Language / 语言',
        apiConnection: 'API 连接',
        defaultValues: '默认值',
        exit: '退出',
      },
      language: {
        prompt: '选择语言:',
      },
      apiConnection: {
        title: '配置前后端地址',
        setApiBaseUrl: '设置后端 API 地址 (/v1)',
        setWebBaseUrl: '设置前端 Web 地址',
        setTimeout: '设置超时时间',
        resetToDefaults: '清空前后端地址配置',
        back: '返回主菜单',
        apiBaseUrlPrompt: '请输入后端 API 地址（必须包含 /v1）:',
        webBaseUrlPrompt: '请输入前端 Web 地址（协议 + 主机 + 端口）:',
        timeoutPrompt: '请输入超时时间 (毫秒):',
        resetConfirm: '是否清空前后端地址配置？',
        apiBaseUrlInvalid: '后端 API 地址无效。示例: http://localhost:3001/v1',
        webBaseUrlInvalid: '前端 Web 地址无效。示例: http://localhost:3000',
      },
      defaultValues: {
        title: '配置默认值',
        setSource: '设置默认来源',
        resetToDefaults: '恢复默认值',
        back: '返回主菜单',
        sourcePrompt: '请输入默认来源:',
        resetConfirm: '是否恢复默认值？',
      },
      common: {
        success: '配置更新成功',
        cancelled: '操作已取消',
        invalidValue: '无效的值',
        resetSuccess: '设置已恢复默认值',
      },
    },
    commands: {
      add: {
        description: '发送内容到收件箱',
        sending: '正在发送到收件箱...',
        created: '条目已创建',
        waiting: '等待 AI 处理...',
        complete: 'AI 处理完成',
        failed: 'AI 处理失败',
        timeout: 'AI 处理超时',
      },
      list: {
        description: '查看所有条目',
        empty: '暂无条目',
        total: '总计',
        pageInfo: '页码',
        selectAction: '选择操作:',
        viewDetails: '查看详情',
        deleteItem: '删除条目',
        prevPage: '上一页',
        nextPage: '下一页',
        gotoPage: '跳转页',
        gotoPrompt: '请输入页码:',
        invalidPage: '页码无效',
        noPrevPage: '已经是第一页',
        noNextPage: '已经是最后一页',
        refresh: '刷新列表',
        exit: '退出',
        selectItem: '选择要查看的条目:',
        selectToDelete: '选择要删除的条目:',
        refreshing: '刷新中...',
        exiting: '退出',
      },
      show: {
        description: '查看条目详情',
        empty: '暂无条目',
        selectItem: '选择要查看的条目:',
        selectAction: '选择操作:',
        edit: '编辑条目',
        delete: '删除条目',
        backToList: '返回列表',
        exit: '退出',
        editInProgress: '编辑功能开发中...',
      },
      delete: {
        description: '删除条目',
        empty: '暂无条目可删除',
        selectItem: '选择要删除的条目:',
        confirmTitle: '删除确认',
        confirm: '确定要删除此条目吗?',
        deleting: '删除中...',
        success: '删除成功',
        cancelled: '已取消删除',
        selectAction: '选择操作:',
        backToList: '返回列表',
        continueDelete: '继续删除',
        exit: '退出',
        continuePrompt: '是否继续删除其他条目?',
      },
      login: {
        description: '登录账户',
        alreadyLoggedIn: '已登录为',
        switchAccount: '是否现在切换到其他账户？',
        usernamePrompt: '用户名:',
        passwordPrompt: '密码:',
        usernameRequired: '请输入用户名',
        passwordRequired: '请输入密码',
        loggingIn: '登录中...',
        success: '登录成功!',
        welcome: '欢迎',
        failed: '登录失败',
      },
      logout: {
        description: '退出登录',
        confirm: '确定要退出登录吗?',
        loggingOut: '退出登录中...',
        success: '退出登录成功',
        failed: '退出登录失败',
      },
      status: {
        description: '查看服务状态',
        checking: '检查服务状态中...',
        running: '服务运行中',
        failed: '服务检查失败',
        version: '版本',
        status: '状态',
        endpoint: '端点',
        user: '用户',
        notLoggedIn: '未登录',
      },
      register: {
        description: '注册新账户（在网页中完成）',
        title: 'SuperInbox 注册',
        alreadyLoggedIn: '已登录为',
        logoutFirst: '如需注册新账户，请先退出登录: sinbox logout',
        instructions: '请在浏览器中打开以下链接完成注册:',
        openBrowser: '在浏览器中打开',
        afterRegister: '注册成功后，使用以下命令登录:',
        loginCommand: 'sinbox login <用户名>',
        webBaseUrlRequired: '前端 Web 地址未配置，请先执行: sinbox config -> API 连接 -> 设置前端 Web 地址',
      },
      config: {
        description: '交互式配置向导',
      },
      auth: {
        required: '需要先登录',
        loginPrompt: '请使用以下命令登录:',
      },
    },
    help: {
      banner: 'SuperInbox CLI',
      subtitle: '智能收件箱命令行工具',
      quickStart: '快速开始:',
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
