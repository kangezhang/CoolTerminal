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
    const pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    const mainPyPath = getResourcePath('main.py');

    console.log('Starting Python server at:', mainPyPath);

    // 检查main.py是否存在
    if (!fs.existsSync(mainPyPath)) {
      reject(new Error(`Python main.py not found at: ${mainPyPath}`));
      return;
    }

    // 启动Python进程（使用 --electron 参数避免交互式输入）
    pythonProcess = spawn(pythonPath, [mainPyPath, SERVER_PORT.toString(), '--electron'], {
      cwd: path.dirname(mainPyPath),
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });

    let serverStartDetected = false;

    pythonProcess.stdout.on('data', (data) => {
      console.log(`[Python]: ${data.toString()}`);

      // 检测服务器启动成功消息
      if (data.toString().includes('Flask服务器正在端口') && !serverStartDetected) {
        serverStartDetected = true;
        console.log('Flask server start message detected, performing health check...');

        // 等待服务器真正可以响应
        checkServerHealth()
          .then(() => {
            resolve();
          })
          .catch((err) => {
            console.error('Health check failed:', err);
            reject(err);
          });
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`[Python Error]: ${data.toString()}`);
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start Python process:', error);
      reject(error);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      pythonProcess = null;
    });

    // 设置超时（10秒）
    setTimeout(() => {
      if (!serverStartDetected) {
        console.log('Timeout waiting for server, trying health check anyway...');
        checkServerHealth(5, 500)
          .then(() => resolve())
          .catch(() => reject(new Error('Python server failed to start within timeout')));
      }
    }, 10000);
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

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '..', 'syncing.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    autoHideMenuBar: true,
    title: 'Connet - 跨设备文件夹同步工具',
    backgroundColor: '#0f0f12', // 匹配项目背景色
    show: false // 先不显示，加载完成后再显示
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
  // 根据平台选择合适的图标格式
  let iconPath;
  if (process.platform === 'darwin') {
    // macOS: 优先使用 .icns，备选 .png（16x16 for retina）
    const icnsPath = path.join(__dirname, '..', 'syncing.icns');
    const pngPath = path.join(__dirname, '..', 'icon.png');

    if (fs.existsSync(icnsPath)) {
      iconPath = icnsPath;
    } else if (fs.existsSync(pngPath)) {
      iconPath = pngPath;
    } else {
      // 使用Electron默认图标
      console.warn('No suitable tray icon found for macOS, using default');
      const icon = nativeImage.createEmpty();
      tray = new Tray(icon);
      tray.setTitle('Connet'); // macOS可以显示文本
      setupTrayMenu();
      return;
    }
  } else {
    // Windows/Linux: 使用 .ico 或 .png
    iconPath = path.join(__dirname, '..', 'syncing.ico');
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(__dirname, '..', 'icon.png');
    }
  }

  try {
    tray = new Tray(iconPath);
  } catch (error) {
    console.error('Failed to create tray icon:', error);
    // 创建空图标作为后备
    const icon = nativeImage.createEmpty();
    tray = new Tray(icon);
    if (process.platform === 'darwin') {
      tray.setTitle('Connet');
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

  tray.setToolTip('Connet - 跨设备同步工具');
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
