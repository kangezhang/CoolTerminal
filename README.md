# CoolTerminal 🚀

> 现代化终端模拟器 - 支持 Windows/Mac/Linux 三平台

## ✨ 特性

### 🎨 界面设计
- **深色玻璃态风格**：精美的毛玻璃效果
- **响应式布局**：完美支持桌面端和移动端
- **流畅动画**：打字机效果、滑入动画、悬停效果

### ⌨️ 终端功能
- **双模式支持**：
  - 🎮 **模拟模式**：安全的预设命令，无需后端（默认）
  - ⚡ **真实模式**：执行真实系统命令，支持三平台
- **打字机效果**：命令输出使用逐字显示动画
- **命令历史**：右侧浮窗，记录最近 50 条不重复命令
- **上下键导航**：快速调用历史命令
- **跨平台 cd**：支持目录切换和路径管理

### 🌍 跨平台支持
- ✅ **Windows**：支持 cmd 和 PowerShell
- ✅ **macOS**：支持 zsh 和 bash
- ✅ **Linux**：支持 bash 和其他 shell

### 🛠️ 内置命令（模拟模式）

| 命令 | 功能 |
|------|------|
| `help` | 显示帮助信息 |
| `clear` / `cls` | 清空终端屏幕 |
| `echo [text]` | 输出文本 |
| `date` | 显示当前日期 |
| `time` | 显示当前时间 |
| `whoami` | 显示当前用户 |
| `pwd` | 显示当前目录 |
| `ls` | 列出文件（带表格） |
| `version` | 显示版本信息 |
| `uname` | 显示平台信息 |
| `sysinfo` | 显示系统信息 |
| `history` | 显示命令历史 |

## 🚀 快速开始

### 前置要求

- **Python 3.8+**
- **Node.js 16+**（可选，用于 Electron 桌面应用）

### 📦 安装

#### 方式 1：使用启动脚本（推荐）

**Windows：**
```bash
# 双击运行
start.bat

# 或命令行运行
.\start.bat
```

**Linux/Mac：**
```bash
# 添加执行权限（首次）
chmod +x start.sh

# 运行
./start.sh
```

#### 方式 2：手动安装

```bash
# 1. 安装 Python 依赖
pip install -r requirements.txt

# 2. 启动服务器
python main.py

# 3. 访问应用
# 浏览器打开: http://localhost:5001
```

#### 方式 3：Electron 桌面应用

```bash
# 1. 安装 Node.js 依赖
npm install

# 2. 启动应用
npm start
```

## 🔐 权限管理

### Windows
```bash
# 方式 1：右键以管理员身份运行
start.bat  # 右键 -> 以管理员身份运行

# 方式 2：命令行
# 打开管理员 CMD，然后运行
python main.py
```

### macOS/Linux
```bash
# 方式 1：使用 sudo（推荐）
sudo python3 main.py

# 方式 2：普通用户运行（某些命令需要权限）
python3 main.py
```

### 权限说明

| 平台 | 普通权限 | 管理员权限 |
|------|----------|-----------|
| Windows | 可执行大部分命令 | 可执行所有命令（注册表、系统服务等） |
| macOS | 可执行用户命令 | 可执行 sudo 命令 |
| Linux | 可执行用户命令 | 可执行 root 命令 |

**提示：**
- 启动时会自动检测权限并给出提示
- 模拟模式不需要任何权限
- 真实模式建议使用管理员权限

## 📁 项目结构

```
CoolTerminal/
├── main.py                 # Python Flask 后端（跨平台）
├── requirements.txt        # Python 依赖
├── start.sh               # Linux/Mac 启动脚本
├── start.bat              # Windows 启动脚本
├── package.json           # Electron 配置（三平台打包）
├── electron/              # Electron 配置
│   ├── main.js           # Electron 主进程
│   ├── preload.js        # 预加载脚本
│   └── loading.html      # 加载页面
├── templates/            # HTML 模板
│   ├── index.html       # 主页
│   ├── base.html        # 基础模板
│   ├── pages/
│   │   └── terminal_tab.html  # 终端页面
│   └── components/
│       └── sidebar.html # 侧边栏
├── static/              # 静态资源
│   ├── css/
│   │   ├── base.css            # 基础样式
│   │   ├── components.css      # 组件样式
│   │   └── terminal.css        # 终端专用样式
│   └── js/
│       ├── app.js             # 主应用逻辑
│       └── terminal.js        # 终端功能（600+ 行）
└── README.md            # 项目文档
```

## 🎯 使用说明

### 模拟模式（默认）

1. 启动应用后，默认使用模拟命令模式
2. 输入命令，按 Enter 执行
3. 支持内置命令，命令未找到会给出提示
4. **优势**：完全安全，跨平台一致，无需后端

### 真实模式

1. 点击右上角「切换到真实模式」按钮
2. 现在可以执行真实的系统命令
3. 支持特性：
   - ✅ Windows: `dir`, `ipconfig`, `tasklist`, PowerShell 命令等
   - ✅ Mac: `ls`, `top`, `ps`, `brew` 等
   - ✅ Linux: `ls`, `ps`, `apt`, `systemctl` 等
   - ✅ 跨平台: `cd`, `pwd`（后端自动处理）
4. ⚠️ **注意**：危险命令会被自动拦截

### 命令历史

- 点击右上角时钟图标打开/关闭历史面板
- 点击历史项快速填充到输入框
- 使用 ↑↓ 键快速调用历史命令
- 自动去重，保留最新的 50 条命令

## 🔒 安全特性

### 危险命令拦截
自动阻止以下危险操作：
- `rm -rf /` - 删除根目录
- `format` - 格式化磁盘
- `shutdown` / `reboot` - 关机/重启
- `mkfs` - 创建文件系统
- `:(){:|:&};:` - Fork 炸弹
- 更多...

### 其他安全机制
- ✅ 命令执行超时：30 秒自动终止
- ✅ 错误处理：完善的错误提示和异常处理
- ✅ 跨域保护：CORS 配置
- ✅ 输入验证：命令内容检查

## 📦 打包部署

### Windows 一键打包（推荐，直接复制执行）

在项目根目录 `D:\Projects\CoolTerminal` 的 PowerShell 里执行：

```powershell
# 推荐：统一入口（等同于 build_installer.bat）
.\start.bat build

# 等价别名（任选其一）
.\start.bat deploy
.\start.bat package
.\start.bat installer

# 直接调用安装包脚本
.\build_installer.bat
```

### Electron 桌面应用

```bash
# 安装依赖
npm install

# 打包 Windows 版本
npm run build:win

# 打包 macOS 版本
npm run build:mac

# 打包 Linux 版本
npm run build:linux

# 打包所有平台
npm run build:all
```

**打包产物：**
- Windows: `dist/CoolTerminal-1.0.0-win-x64.exe` (安装包)
- Windows: `dist/CoolTerminal-1.0.0-win-x64-portable.exe` (便携版)
- macOS: `dist/CoolTerminal-1.0.0-mac-x64.dmg`
- macOS: `dist/CoolTerminal-1.0.0-mac-arm64.dmg` (Apple Silicon)
- Linux: `dist/CoolTerminal-1.0.0-linux-x64.AppImage`
- Linux: `dist/CoolTerminal-1.0.0-linux-x64.deb`
- Linux: `dist/CoolTerminal-1.0.0-linux-x64.rpm`

### Python 独立可执行文件

使用 PyInstaller 打包：

```bash
# 安装 PyInstaller
pip install pyinstaller

# 打包（单文件）
pyinstaller --onefile --windowed --name CoolTerminal main.py

# 打包产物在 dist/ 目录
```

## 🛠️ 技术栈

### 后端
- Python 3.8+
- Flask 3.0.0
- Flask-CORS 4.0.0
- psutil 5.9.6（可选，用于增强系统信息）

### 前端
- 原生 JavaScript（ES6+）
- CSS3（毛玻璃效果、动画）
- Feather Icons

### 桌面应用
- Electron 27.0+
- electron-builder（跨平台打包）

### 跨平台
- subprocess（Python 跨平台命令执行）
- platform（平台检测）
- os / pathlib（路径处理）

## 🔧 开发

### 调试模式

```bash
# Flask 开发服务器（自动重载）
python main.py

# Electron 开发模式
npm run dev
```

### 添加新命令

在 `static/js/terminal.js` 中添加：

```javascript
const commands = {
    // ...现有命令
    mycommand: () => this.cmdMyCommand(),
};

async cmdMyCommand() {
    await this.typeOutput('我的命令输出', 'success');
}
```

## ❓ 常见问题

### Q: 真实模式为什么命令执行失败？
A: 可能是权限不足，请使用管理员/root 权限运行。

### Q: Windows 中文乱码？
A: 已自动使用 GBK 编码处理，如仍有问题，请在 PowerShell 中运行。

### Q: macOS 提示权限问题？
A: 使用 `sudo python3 main.py` 启动，或在系统设置中授予权限。

### Q: 如何打包成独立应用？
A: 使用 `npm run build` 打包 Electron 应用，或使用 PyInstaller 打包 Python。

## 📄 许可证

MIT License

## 🙏 致谢

- Feather Icons
- Flask
- Electron
- Python Community

---

Made with ❤️ by CoolTerminal Team

**支持平台：** Windows 7+ / macOS 10.13+ / Linux (Ubuntu 18.04+)
