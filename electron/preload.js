const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 获取服务器端口
  getServerPort: () => {
    return new Promise((resolve) => {
      ipcRenderer.once('server-port', (event, port) => {
        resolve(port);
      });
      ipcRenderer.send('get-server-port');
    });
  },

  // 退出应用
  quitApp: () => {
    ipcRenderer.send('quit-app');
  },

  // 检测是否在Electron环境
  isElectron: true,

  // 平台信息
  platform: process.platform,

  // 版本信息
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  }
});

// 页面加载完成后的初始化
window.addEventListener('DOMContentLoaded', () => {
  console.log('Electron Preload: DOMContentLoaded');
});
