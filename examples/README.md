# CoolTerminal 示例

本目录包含了各种集成示例，展示如何在不同场景下使用 CoolTerminal 模块。

## 📁 文件说明

### 1. basic.html
**基础 HTML 集成示例**

最简单的使用方式，适合快速开始。

**特点：**
- 纯 HTML + JavaScript
- 无需构建工具
- 完整的基础功能演示
- 事件监听示例

**运行方式：**
```bash
# 确保 Python 后端正在运行
cd ..
python main.py

# 在浏览器中打开
open examples/basic.html
```

---

### 2. react-example.jsx
**React 集成示例**

展示如何在 React 应用中使用 CoolTerminal。

**特点：**
- React Hooks (useEffect, useRef, useState)
- 组件化封装
- 事件日志面板
- 父子组件通信

**使用方式：**
```jsx
import Terminal from './react-example.jsx';

function App() {
    return <Terminal apiEndpoint="http://localhost:5000/api/terminal/execute" />;
}
```

---

### 3. vue-example.vue
**Vue 集成示例**

展示如何在 Vue 应用中使用 CoolTerminal。

**特点：**
- Vue 3 Composition API
- 响应式状态管理
- 实时统计面板
- 最近输出记录

**使用方式：**
```vue
<template>
    <TerminalApp />
</template>

<script>
import TerminalApp from './vue-example.vue';
export default { components: { TerminalApp } };
</script>
```

---

### 4. multi-terminal.html
**多终端实例示例**

演示如何在同一页面中创建和管理多个独立终端。

**特点：**
- 4 个独立终端实例
- 不同主题（深色/浅色）
- 不同配置（打字速度、提示符）
- 全局批量控制

**亮点：**
- 终端 1: 深色主题，标准速度
- 终端 2: 浅色主题
- 终端 3: 快速模式（无打字机效果）
- 终端 4: 自定义提示符

---

## 🚀 快速开始

### 前置条件

1. **启动后端服务**
```bash
cd /home/user/CoolTerminal
python main.py
```

2. **在浏览器中打开示例文件**
```bash
# 直接打开 HTML 文件
open examples/basic.html
open examples/multi-terminal.html
```

### 使用框架示例

**React:**
```bash
# 复制到你的 React 项目
cp examples/react-example.jsx your-react-app/src/components/

# 在组件中使用
import Terminal from './components/react-example.jsx';
```

**Vue:**
```bash
# 复制到你的 Vue 项目
cp examples/vue-example.vue your-vue-app/src/components/

# 在组件中使用
import TerminalApp from './components/vue-example.vue';
```

---

## 🎯 示例对比

| 示例 | 难度 | 适用场景 | 特色功能 |
|------|------|----------|----------|
| basic.html | ⭐ 简单 | 快速开始 | 基础功能展示 |
| react-example.jsx | ⭐⭐ 中等 | React 项目 | Hooks + 事件日志 |
| vue-example.vue | ⭐⭐ 中等 | Vue 项目 | 响应式 + 统计面板 |
| multi-terminal.html | ⭐⭐⭐ 高级 | 复杂应用 | 多实例管理 |

---

## 📚 学习路径

### 新手推荐
1. 先看 `basic.html` 了解基础用法
2. 查看 `MODULE_INTEGRATION.md` 了解完整 API
3. 根据项目框架选择对应示例

### 进阶开发
1. 研究 `multi-terminal.html` 学习多实例管理
2. 自定义样式和主题
3. 集成到实际项目中

---

## 🔧 自定义示例

你可以基于这些示例创建自己的集成：

```javascript
const terminal = CoolTerminal.create({
    container: '#my-terminal',
    theme: 'dark',
    apiEndpoint: 'https://your-api.com/execute',

    // 自定义配置
    welcomeMessage: '欢迎使用我的终端',
    prompt: '🚀',
    typingSpeed: 15,

    // 其他配置...
});

// 监听事件
terminal.on('command', handleCommand);
terminal.on('output', handleOutput);
terminal.on('error', handleError);
```

---

## 💡 提示

1. **API 端点**: 所有示例默认使用 `http://localhost:5000/api/terminal/execute`，请根据实际情况修改
2. **CORS 问题**: 如果遇到跨域问题，需要在后端配置 CORS
3. **路径调整**: 根据实际项目结构调整 `coolterminal.module.js` 的引入路径
4. **事件监听**: 善用事件系统来实现自定义功能

---

## 📝 常见问题

**Q: 示例无法连接到后端？**
A: 确保 Python 后端正在运行 (`python main.py`)，并检查 API 端点地址是否正确。

**Q: 如何修改主题？**
A: 设置 `theme: 'light'` 或 `theme: 'dark'`，或者通过 CSS 自定义样式。

**Q: 可以创建多少个终端实例？**
A: 理论上没有限制，但建议根据性能和实际需求控制数量。

**Q: 如何禁用打字机效果？**
A: 设置 `typingSpeed: 0`。

---

## 🤝 贡献

欢迎提交更多示例！如果你创建了有趣的集成方案，可以：

1. Fork 项目
2. 添加你的示例
3. 提交 Pull Request

---

## 📄 许可证

所有示例代码遵循 MIT License，可自由使用和修改。
