#!/usr/bin/env node

/**
 * SuperInbox 启动工具 (Node.js 版本)
 * 功能: 检查端口占用,提供选项停止占用进程,然后启动前后端服务
 */

import { spawn, exec } from 'child_process';
import { readFile, writeFile, existsSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置
const CONFIG = {
  backendPort: parseInt(process.env.BACKEND_PORT) || 3000,
  frontendPort: parseInt(process.env.FRONTEND_PORT) || 3001,
  projectRoot: __dirname,
  backendDir: join(__dirname, 'backend'),
  webDir: join(__dirname, 'web'),
  backendPidFile: join(__dirname, '.backend.pid'),
  frontendPidFile: join(__dirname, '.frontend.pid'),
  backendLogFile: join(__dirname, 'backend.log'),
  frontendLogFile: join(__dirname, 'frontend.log')
};

// 颜色定义
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// 日志函数
const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`)
};

// 工具函数
const execPromise = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 检查端口是否被占用
async function checkPort(port, serviceName) {
  try {
    // macOS/Linux 使用 lsof
    const result = await execPromise(`lsof -i :${port} -sTCP:LISTEN -t`);
    if (result) {
      const pids = result.split('\n').filter(line => line.trim());
      if (pids.length > 0) {
        const pid = pids[0];
        try {
          const command = await execPromise(`ps -p ${pid} -o command=`);
          log.warning(`端口 ${port} (${serviceName}) 已被占用`);
          console.log(`  进程 PID: ${pid}`);
          console.log(`  进程命令: ${command}`);
          return { occupied: true, pid, command };
        } catch (e) {
          // 进程可能已退出
        }
      }
    }
    return { occupied: false };
  } catch (error) {
    // 端口未被占用
    return { occupied: false };
  }
}

// 停止占用端口的进程
async function killPortProcess(port, serviceName) {
  try {
    const result = await execPromise(`lsof -ti :${port}`);
    if (result) {
      const pids = result.split('\n').filter(line => line.trim());
      for (const pid of pids) {
        log.info(`正在停止占用端口 ${port} 的进程 (PID: ${pid})...`);
        try {
          await execPromise(`kill -9 ${pid}`);
          log.success(`已停止进程 ${pid}`);
          await sleep(1000);
        } catch (e) {
          log.error(`无法停止进程 ${pid}`);
          return false;
        }
      }
    }
    return true;
  } catch (error) {
    return true;
  }
}

// 用户输入提示
function question(query) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

// 处理端口冲突
async function handlePortConflict(port, serviceName) {
  const checkResult = await checkPort(port, serviceName);

  if (!checkResult.occupied) {
    return 'continue';
  }

  console.log('');
  console.log('发现以下选项:');
  console.log('  1) 停止占用端口的进程并继续');
  console.log('  2) 跳过该服务启动');
  console.log('  3) 退出脚本');
  console.log('');

  const choice = await question('请选择操作 [1-3]: ');

  switch (choice.trim()) {
    case '1':
      const success = await killPortProcess(port, serviceName);
      return success ? 'continue' : 'skip';
    case '2':
      log.warning(`跳过 ${serviceName} 启动`);
      return 'skip';
    case '3':
      log.info('退出脚本');
      process.exit(0);
    default:
      log.error('无效选择,退出脚本');
      process.exit(1);
  }
}

// 检查依赖
async function checkDependencies() {
  log.info('检查依赖...');

  try {
    await execPromise('node --version');
    await execPromise('npm --version');
    log.success('依赖检查完成');
    return true;
  } catch (error) {
    log.error('Node.js 或 npm 未安装,请先安装 Node.js (>= 18.0.0)');
    return false;
  }
}

// 安装依赖
async function installDependencies() {
  log.info('安装后端依赖...');
  if (existsSync(CONFIG.backendDir)) {
    process.chdir(CONFIG.backendDir);
    if (!existsSync(join(CONFIG.backendDir, 'node_modules'))) {
      await execPromise('npm install');
      log.success('后端依赖安装完成');
    } else {
      log.info('后端依赖已存在,跳过安装');
    }
  }

  log.info('安装前端依赖...');
  if (existsSync(CONFIG.webDir)) {
    process.chdir(CONFIG.webDir);
    if (!existsSync(join(CONFIG.webDir, 'node_modules'))) {
      await execPromise('npm install');
      log.success('前端依赖安装完成');
    } else {
      log.info('前端依赖已存在,跳过安装');
    }
  }
}

// 启动后端服务
async function startBackend() {
  process.chdir(CONFIG.backendDir);

  const result = await handlePortConflict(CONFIG.backendPort, '后端');
  if (result === 'skip') {
    return false;
  }

  log.info(`启动后端服务 (端口: ${CONFIG.backendPort})...`);

  const backend = spawn('npm', ['run', 'dev'], {
    env: { ...process.env, PORT: CONFIG.backendPort },
    shell: true
  });

  // 保存 PID
  writeFile(CONFIG.backendPidFile, backend.pid.toString(), (err) => {
    if (err) log.error('无法保存后端 PID');
  });

  // 重定向输出到日志文件
  const logStream = require('fs').createWriteStream(CONFIG.backendLogFile, { flags: 'a' });
  backend.stdout.pipe(logStream);
  backend.stderr.pipe(logStream);

  // 等待后端启动
  await sleep(3000);

  // 检查进程是否仍在运行
  try {
    process.kill(backend.pid, 0); // 检查进程是否存在
    log.success(`后端服务启动成功 (PID: ${backend.pid})`);
    log.info(`后端日志: ${CONFIG.backendLogFile}`);
    return true;
  } catch (e) {
    log.error('后端服务启动失败,请查看日志');
    return false;
  }
}

// 启动前端服务
async function startFrontend() {
  process.chdir(CONFIG.webDir);

  const result = await handlePortConflict(CONFIG.frontendPort, '前端');
  if (result === 'skip') {
    return false;
  }

  log.info(`启动前端服务 (端口: ${CONFIG.frontendPort})...`);

  const frontend = spawn('npm', ['run', 'dev'], {
    env: { ...process.env, PORT: CONFIG.frontendPort },
    shell: true
  });

  // 保存 PID
  writeFile(CONFIG.frontendPidFile, frontend.pid.toString(), (err) => {
    if (err) log.error('无法保存前端 PID');
  });

  // 重定向输出到日志文件
  const logStream = require('fs').createWriteStream(CONFIG.frontendLogFile, { flags: 'a' });
  frontend.stdout.pipe(logStream);
  frontend.stderr.pipe(logStream);

  // 等待前端启动
  await sleep(3000);

  // 检查进程是否仍在运行
  try {
    process.kill(frontend.pid, 0); // 检查进程是否存在
    log.success(`前端服务启动成功 (PID: ${frontend.pid})`);
    log.info(`前端日志: ${CONFIG.frontendLogFile}`);
    return true;
  } catch (e) {
    log.error('前端服务启动失败,请查看日志');
    return false;
  }
}

// 停止服务
async function stopServices() {
  log.info('停止所有服务...');

  // 停止后端
  if (existsSync(CONFIG.backendPidFile)) {
    const pid = parseInt(await new Promise((resolve, reject) => {
      readFile(CONFIG.backendPidFile, 'utf8', (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    }));

    try {
      process.kill(pid, 'SIGTERM');
      log.success(`已停止后端服务 (PID: ${pid})`);
    } catch (e) {
      // 进程可能已停止
    }
    require('fs').unlinkSync(CONFIG.backendPidFile);
  }

  // 停止前端
  if (existsSync(CONFIG.frontendPidFile)) {
    const pid = parseInt(await new Promise((resolve, reject) => {
      readFile(CONFIG.frontendPidFile, 'utf8', (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    }));

    try {
      process.kill(pid, 'SIGTERM');
      log.success(`已停止前端服务 (PID: ${pid})`);
    } catch (e) {
      // 进程可能已停止
    }
    require('fs').unlinkSync(CONFIG.frontendPidFile);
  }
}

// 显示服务状态
async function showStatus() {
  console.log('');
  console.log('========== 服务状态 ==========');
  console.log('');

  // 后端状态
  if (existsSync(CONFIG.backendPidFile)) {
    const pid = parseInt(await new Promise((resolve, reject) => {
      readFile(CONFIG.backendPidFile, 'utf8', (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    }));

    try {
      process.kill(pid, 0);
      console.log(`后端服务: ${colors.green}运行中${colors.reset} (PID: ${pid}, 端口: ${CONFIG.backendPort})`);
    } catch (e) {
      console.log(`后端服务: ${colors.red}已停止${colors.reset}`);
      require('fs').unlinkSync(CONFIG.backendPidFile);
    }
  } else {
    console.log(`后端服务: ${colors.yellow}未启动${colors.reset}`);
  }

  // 前端状态
  if (existsSync(CONFIG.frontendPidFile)) {
    const pid = parseInt(await new Promise((resolve, reject) => {
      readFile(CONFIG.frontendPidFile, 'utf8', (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    }));

    try {
      process.kill(pid, 0);
      console.log(`前端服务: ${colors.green}运行中${colors.reset} (PID: ${pid}, 端口: ${CONFIG.frontendPort})`);
    } catch (e) {
      console.log(`前端服务: ${colors.red}已停止${colors.reset}`);
      require('fs').unlinkSync(CONFIG.frontendPidFile);
    }
  } else {
    console.log(`前端服务: ${colors.yellow}未启动${colors.reset}`);
  }

  console.log('');
  console.log('============================');
  console.log('');
}

// 主函数
async function main() {
  console.log('');
  console.log('======================================');
  console.log('       SuperInbox 启动工具');
  console.log('======================================');
  console.log('');

  const command = process.argv[2];

  if (command) {
    switch (command) {
      case 'stop':
        await stopServices();
        process.exit(0);
      case 'status':
        await showStatus();
        process.exit(0);
      case 'restart':
        await stopServices();
        await sleep(2000);
        break;
      default:
        console.log('用法: node start.js [stop|status|restart]');
        console.log('  无参数: 启动所有服务');
        console.log('  stop: 停止所有服务');
        console.log('  status: 查看服务状态');
        console.log('  restart: 重启所有服务');
        process.exit(1);
    }
  }

  // 检查依赖
  const depsOk = await checkDependencies();
  if (!depsOk) {
    process.exit(1);
  }

  // 询问是否安装依赖
  const needsInstall =
    !existsSync(join(CONFIG.backendDir, 'node_modules')) ||
    !existsSync(join(CONFIG.webDir, 'node_modules'));

  if (needsInstall) {
    console.log('');
    const answer = await question('是否需要安装依赖? [y/N]: ');
    if (answer.toLowerCase() === 'y') {
      await installDependencies();
    }
  }

  // 停止已存在的服务
  await stopServices();
  await sleep(1000);

  // 启动服务
  console.log('');
  log.info('开始启动服务...');
  console.log('');

  const backendSuccess = await startBackend();
  const frontendSuccess = await startFrontend();

  // 显示启动结果
  console.log('');
  console.log('======================================');
  console.log('           启动完成');
  console.log('======================================');
  console.log('');

  if (backendSuccess) {
    console.log(`${colors.green}✓${colors.reset} 后端服务: ${colors.green}http://localhost:${CONFIG.backendPort}${colors.reset}`);
    console.log(`  API 端点: http://localhost:${CONFIG.backendPort}/v1`);
  } else {
    console.log(`${colors.red}✗${colors.reset} 后端服务: ${colors.red}启动失败${colors.reset}`);
  }

  if (frontendSuccess) {
    console.log(`${colors.green}✓${colors.reset} 前端服务: ${colors.green}http://localhost:${CONFIG.frontendPort}${colors.reset}`);
  } else {
    console.log(`${colors.red}✗${colors.reset} 前端服务: ${colors.red}启动失败${colors.reset}`);
  }

  console.log('');
  console.log('使用命令:');
  console.log('  查看状态: node start.js status');
  console.log('  停止服务: node start.js stop');
  console.log('  重启服务: node start.js restart');
  console.log('');

  log.info('服务已在后台运行');
  log.info(`查看后端日志: tail -f ${CONFIG.backendLogFile}`);
  log.info(`查看前端日志: tail -f ${CONFIG.frontendLogFile}`);
}

// 运行主函数
main().catch(error => {
  log.error(error.message);
  process.exit(1);
});
