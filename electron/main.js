const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');

// Python服务器管理
let pythonProcess = null;
let mainWindow = null;
let tray = null;
const SERVER_PORT = 5001;

// 获取资源路径
function getResourcePath(relativePath) {
  if (app.isPackaged) {
    // 打包后，Python文件在resources/app目录
    return path.join(process.resourcesPath, 'app', relativePath);
  } else {
    // 开发模式
    return path.join(__dirname, '..', relativePath);
  }
}

// 健康检查：检查服务器是否真的可以响应
function checkServerHealth(maxRetries = 10, delayMs = 300) {
  return new Promise((resolve, reject) => {
    let retries = 0;

    const check = () => {
      const req = http.get(`http://127.0.0.1:${SERVER_PORT}/`, (res) => {
        if (res.statusCode === 200) {
          console.log('Server health check passed!');
          resolve();
        } else {
          retry();
        }
      });

      req.on('error', (err) => {
        retry();
      });

      req.setTimeout(500, () => {
        req.destroy();
        retry();
      });
    };

    const retry = () => {
      retries++;
      if (retries >= maxRetries) {
        reject(new Error('Server failed to respond after multiple retries'));
      } else {
        console.log(`Health check retry ${retries}/${maxRetries}...`);
        setTimeout(check, delayMs);
      }
    };

    check();
  });
}

// 启动Python服务器
function startPythonServer() {
  return new Promise((resolve, reject) => {
    let execPath, execArgs, cwd;

    if (app.isPackaged) {
      // 打包后：运行 PyInstaller 生成的独立 exe
      const exeName = process.platform === 'win32' ? 'coolterminal_server.exe' : 'coolterminal_server';
      execPath = path.join(process.resourcesPath, 'server', exeName);
      execArgs = [SERVER_PORT.toString()];
      cwd = path.join(process.resourcesPath, 'server');
    } else {
      // 开发模式：直接运行 python main.py
      execPath = process.platform === 'win32' ? 'python' : 'python3';
      execArgs = [getResourcePath('main.py'), SERVER_PORT.toString()];
      cwd = path.dirname(getResourcePath('main.py'));
    }

    console.log('Starting server:', execPath, execArgs);

    if (!fs.existsSync(app.isPackaged ? execPath : getResourcePath('main.py'))) {
      reject(new Error(`Server not found at: ${execPath}`));
      return;
    }

    pythonProcess = spawn(execPath, execArgs, {
      cwd,
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    let serverStartDetected = false;

    pythonProcess.stdout.on('data', (data) => {
      const text = data.toString();
      console.log(`[Server]: ${text}`);

      // 检测服务器启动成功（匹配新版 main.py 的输出）
      if (!serverStartDetected && (
        text.includes('服务器正在端口') ||
        text.includes('Running on') ||
        text.includes('Listening on')
      )) {
        serverStartDetected = true;
        checkServerHealth()
          .then(() => resolve())
          .catch((err) => reject(err));
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const text = data.toString();
      console.error(`[Server Error]: ${text}`);
      // eventlet/socketio 的正常启动信息也走 stderr
      if (!serverStartDetected && (
        text.includes('Running on') ||
        text.includes('Listening on')
      )) {
        serverStartDetected = true;
        checkServerHealth()
          .then(() => resolve())
          .catch((err) => reject(err));
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start server process:', error);
      reject(error);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
      pythonProcess = null;
    });

    // 15秒超时后直接做健康检查
    setTimeout(() => {
      if (!serverStartDetected) {
        console.log('Startup message not detected, trying health check...');
        checkServerHealth(10, 800)
          .then(() => resolve())
          .catch(() => reject(new Error('Server failed to start within 15s')));
      }
    }, 15000);
  });
}

// 停止Python服务器
function stopPythonServer() {
  if (pythonProcess) {
    console.log('Stopping Python server...');
    pythonProcess.kill();
    pythonProcess = null;
  }
}

// 获取图标路径
function getIconPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app', 'assets', 'icon_terminal.ico');
  }
  return path.join(__dirname, '..', 'assets', 'icon_terminal.ico');
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    autoHideMenuBar: true,
    title: 'CoolTerminal',
    backgroundColor: '#0f0f12',
    show: false
  });

  // 先加载loading页面
  const loadingPath = path.join(__dirname, 'loading.html');
  mainWindow.loadFile(loadingPath);

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 后台启动Python服务器
  startPythonServer()
    .then(() => {
      console.log('Python server is ready, loading UI...');
      // 服务器已通过健康检查，加载实际应用
      mainWindow.loadURL(`http://127.0.0.1:${SERVER_PORT}`);
    })
    .catch((error) => {
      console.error('Failed to start Python server:', error);
      dialog.showErrorBox(
        '启动失败',
        `无法启动Python服务器:\n${error.message}\n\n请确保已安装Python和所需依赖:\npip install -r requirements.txt`
      );
      app.quit();
    });

  // 开发者工具（仅在明确指定时打开）
  // 使用环境变量 DEBUG=1 来开启：DEBUG=1 npm start
  if (process.env.DEBUG === '1') {
    mainWindow.webContents.openDevTools();
  }

  // 窗口关闭时隐藏到托盘
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 创建系统托盘
function createTray() {
  const iconPath = getIconPath();

  try {
    tray = new Tray(iconPath);
  } catch (error) {
    console.error('Failed to create tray icon:', error);
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    if (process.platform === 'darwin') {
      tray.setTitle('CoolTerminal');
    }
  }

  setupTrayMenu();
}

function setupTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('CoolTerminal - 现代化终端模拟器');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}

// 应用准备就绪
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// 所有窗口关闭
app.on('window-all-closed', () => {
  // macOS下保持应用运行
  if (process.platform !== 'darwin') {
    // 其他平台隐藏到托盘
    // app.quit();
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', () => {
  stopPythonServer();
});

// IPC通信
ipcMain.on('get-server-port', (event) => {
  event.reply('server-port', SERVER_PORT);
});

ipcMain.on('quit-app', () => {
  app.isQuitting = true;
  app.quit();
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
