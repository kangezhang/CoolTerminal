# CoolTerminal 🚀

> 现代化终端模拟器 - 支持打字机效果、命令历史、模拟/真实命令执行

## ✨ 特性

### 🎨 界面设计
- **深色玻璃态风格**：精美的毛玻璃效果
- **响应式布局**：完美支持桌面端和移动端
- **流畅动画**：打字机效果、滑入动画、悬停效果

### ⌨️ 终端功能
- **双模式支持**：模拟命令 / 真实命令（可切换）
- **打字机效果**：命令输出使用逐字显示动画
- **命令历史**：右侧浮窗，记录最近 50 条不重复命令
- **上下键导航**：快速调用历史命令
- **自动聚焦**：点击终端区域自动聚焦输入框

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

- Python 3.8+
- Node.js 16+ （可选，用于 Electron）

### 安装依赖

```bash
# 安装 Python 依赖
pip install -r requirements.txt

# 安装 Node.js 依赖（如果使用 Electron）
npm install
```

### 启动方式

#### 方式 1：Python Flask 服务器（推荐开发）

```bash
python main.py
```

然后访问：http://localhost:5001

#### 方式 2：Electron 桌面应用

```bash
npm start
```

## 📁 项目结构

```
CoolTerminal/
├── main.py                 # Python Flask 后端
├── requirements.txt        # Python 依赖
├── electron/              # Electron 配置
│   ├── main.js           # Electron 主进程
│   ├── preload.js        # 预加载脚本
│   └── loading.html      # 加载页面
├── templates/            # HTML 模板
│   ├── index.html       # 主页
│   ├── base.html        # 基础模板
│   ├── pages/           # 页面模板
│   │   └── terminal_tab.html  # 终端页面
│   └── components/      # 组件模板
│       └── sidebar.html # 侧边栏
├── static/              # 静态资源
│   ├── css/
│   │   ├── base.css            # 基础样式
│   │   ├── components.css      # 组件样式
│   │   └── terminal.css        # 终端专用样式
│   └── js/
│       ├── app.js             # 主应用逻辑
│       ├── terminal.js        # 终端功能
│       └── ...               # 其他模块
└── README.md            # 项目文档
```

## 🎯 使用说明

### 模拟模式（默认）

1. 启动应用后，默认使用模拟命令模式
2. 输入命令，按 Enter 执行
3. 支持内置命令，命令未找到会给出提示

### 真实模式

1. 点击右上角「切换到真实模式」按钮
2. 现在可以执行真实的系统命令
3. ⚠️ 注意：危险命令会被拦截（如 `rm -rf`）

### 命令历史

- 点击右上角时钟图标打开/关闭历史面板
- 点击历史项快速填充到输入框
- 使用 ↑↓ 键快速调用历史命令
- 自动去重，保留最新的 50 条命令

## 🔒 安全特性

- **危险命令拦截**：自动阻止 `rm -rf`、`format`、`shutdown` 等危险命令
- **执行超时**：命令执行超过 10 秒自动终止
- **错误处理**：完善的错误提示和异常处理

## 🛠️ 技术栈

### 后端
- Python 3.8+
- Flask 3.0.0
- Flask-CORS 4.0.0
- psutil 5.9.6（可选）

### 前端
- 原生 JavaScript（ES6+）
- CSS3（毛玻璃效果）
- Feather Icons

### 桌面应用（可选）
- Electron

## 📝 开发

### 调试模式

```bash
# 启动 Flask 开发服务器（自动重载）
python main.py

# 启动 Electron 开发模式
DEBUG=1 npm start
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

## 📄 许可证

MIT License

## 🙏 致谢

- Feather Icons
- Flask
- Electron

---

Made with ❤️ by CoolTerminal Team
