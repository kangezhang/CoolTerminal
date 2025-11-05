# CoolTerminal 模块集成指南

CoolTerminal 不仅可以作为独立工具使用，还可以作为模块集成到任意项目中。

## 📦 安装方式

### 方式一：直接引入（推荐快速开始）

```html
<!-- 引入模块文件 -->
<script src="path/to/coolterminal.module.js"></script>

<script>
  // 创建终端实例
  const terminal = CoolTerminal.create({
    container: '#terminal-container',
    theme: 'dark'
  });
</script>
```

### 方式二：ES6 模块导入

```javascript
import CoolTerminal from './coolterminal.module.js';

const terminal = CoolTerminal.create({
  container: document.getElementById('app')
});
```

### 方式三：NPM 包（需要先发布到 npm）

```bash
npm install coolterminal
```

```javascript
import CoolTerminal from 'coolterminal';
```

---

## 🚀 快速开始

### 基础示例

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>CoolTerminal 集成示例</title>
    <style>
        #terminal {
            width: 800px;
            height: 600px;
            margin: 20px auto;
        }
    </style>
</head>
<body>
    <div id="terminal"></div>

    <script src="./static/js/coolterminal.module.js"></script>
    <script>
        // 创建终端实例
        const terminal = CoolTerminal.create({
            container: '#terminal',
            theme: 'dark',
            apiEndpoint: 'http://localhost:5000/api/terminal/execute',
            welcomeMessage: '欢迎使用终端！输入 help 查看帮助'
        });

        // 监听命令执行
        terminal.on('command', (data) => {
            console.log('执行命令:', data.command);
        });

        // 监听输出
        terminal.on('output', (data) => {
            console.log('命令输出:', data.output);
        });
    </script>
</body>
</html>
```

---

## ⚙️ 配置选项

```javascript
const terminal = CoolTerminal.create({
    // 必选：终端挂载容器
    container: '#terminal',           // CSS 选择器或 DOM 元素

    // 可选：API 配置
    apiEndpoint: '/api/terminal/execute',  // 后端 API 地址

    // 可选：外观配置
    theme: 'dark',                    // 主题：'dark' | 'light'
    prompt: '$',                      // 命令提示符

    // 可选：行为配置
    typingSpeed: 20,                  // 打字机效果速度（毫秒）
    autoFocus: true,                  // 自动聚焦输入框

    // 可选：历史记录配置
    enableHistory: true,              // 启用命令历史
    maxHistorySize: 100,              // 最大历史记录数

    // 可选：欢迎消息配置
    showWelcome: true,                // 显示欢迎消息
    welcomeMessage: '欢迎使用 CoolTerminal'
});
```

---

## 🎯 API 接口

### 创建实例

```javascript
const terminal = CoolTerminal.create(options);
```

### 执行命令

```javascript
// 方式一：通过用户输入（自动）
// 用户在输入框按回车自动执行

// 方式二：编程方式执行
const result = await terminal.execute('ls -la');
console.log(result.success);  // true/false
console.log(result.output);   // 命令输出
console.log(result.exitCode); // 退出代码
```

### 写入输出

```javascript
// 直接写入文本（无打字机效果）
terminal.writeOutput('这是一条信息', 'info');
terminal.writeOutput('成功！', 'success');
terminal.writeOutput('警告！', 'warning');
terminal.writeOutput('错误！', 'error');
```

### 清空终端

```javascript
terminal.clear();
```

### 聚焦输入框

```javascript
terminal.focus();
```

### 销毁实例

```javascript
terminal.destroy();
```

---

## 📡 事件系统

### 监听事件

```javascript
terminal.on('ready', (data) => {
    console.log('终端已就绪');
});

terminal.on('command', (data) => {
    console.log('执行命令:', data.command);
});

terminal.on('output', (data) => {
    console.log('输出:', data.output);
    console.log('退出代码:', data.exitCode);
});

terminal.on('error', (data) => {
    console.log('错误:', data.error);
});

terminal.on('clear', () => {
    console.log('终端已清空');
});

terminal.on('destroy', () => {
    console.log('终端已销毁');
});
```

### 移除事件监听

```javascript
// 移除特定处理器
const handler = (data) => console.log(data);
terminal.on('command', handler);
terminal.off('command', handler);

// 移除所有处理器
terminal.off('command');
```

### 链式调用

```javascript
terminal
    .on('ready', () => console.log('就绪'))
    .on('command', (data) => console.log(data.command))
    .on('error', (data) => console.error(data.error));
```

---

## 🎨 集成场景示例

### 1. 在 React 中使用

```jsx
import React, { useEffect, useRef } from 'react';
import CoolTerminal from './coolterminal.module.js';

function TerminalComponent() {
    const containerRef = useRef(null);
    const terminalRef = useRef(null);

    useEffect(() => {
        // 创建终端
        terminalRef.current = CoolTerminal.create({
            container: containerRef.current,
            theme: 'dark',
            apiEndpoint: '/api/terminal/execute'
        });

        // 监听事件
        terminalRef.current.on('command', (data) => {
            console.log('Command:', data.command);
        });

        // 清理
        return () => {
            terminalRef.current?.destroy();
        };
    }, []);

    return <div ref={containerRef} style={{ width: '100%', height: '500px' }} />;
}

export default TerminalComponent;
```

### 2. 在 Vue 中使用

```vue
<template>
    <div ref="terminalContainer" class="terminal-wrapper"></div>
</template>

<script>
import CoolTerminal from './coolterminal.module.js';

export default {
    name: 'Terminal',
    data() {
        return {
            terminal: null
        };
    },
    mounted() {
        this.terminal = CoolTerminal.create({
            container: this.$refs.terminalContainer,
            theme: 'dark',
            apiEndpoint: '/api/terminal/execute'
        });

        this.terminal.on('command', (data) => {
            this.$emit('command', data.command);
        });
    },
    beforeUnmount() {
        this.terminal?.destroy();
    }
};
</script>

<style scoped>
.terminal-wrapper {
    width: 100%;
    height: 500px;
}
</style>
```

### 3. 在 Angular 中使用

```typescript
import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import CoolTerminal from './coolterminal.module.js';

@Component({
    selector: 'app-terminal',
    template: '<div #terminalContainer class="terminal-wrapper"></div>',
    styles: ['.terminal-wrapper { width: 100%; height: 500px; }']
})
export class TerminalComponent implements OnInit, OnDestroy {
    @ViewChild('terminalContainer', { static: true }) containerRef!: ElementRef;
    private terminal: any;

    ngOnInit() {
        this.terminal = CoolTerminal.create({
            container: this.containerRef.nativeElement,
            theme: 'dark',
            apiEndpoint: '/api/terminal/execute'
        });

        this.terminal.on('command', (data: any) => {
            console.log('Command:', data.command);
        });
    }

    ngOnDestroy() {
        this.terminal?.destroy();
    }
}
```

### 4. 多终端实例

```javascript
// 创建多个终端实例
const terminal1 = CoolTerminal.create({
    container: '#terminal1',
    welcomeMessage: '终端 1'
});

const terminal2 = CoolTerminal.create({
    container: '#terminal2',
    welcomeMessage: '终端 2',
    theme: 'light'
});

// 在终端 1 执行命令
await terminal1.execute('ls');

// 在终端 2 执行命令
await terminal2.execute('pwd');
```

### 5. 自定义主题

```javascript
const terminal = CoolTerminal.create({
    container: '#terminal',
    theme: 'light'  // 使用浅色主题
});

// 或者通过 CSS 自定义样式
// 在页面中添加自定义样式覆盖默认样式
```

### 6. 编程式控制

```javascript
const terminal = CoolTerminal.create({
    container: '#terminal',
    typingSpeed: 0  // 禁用打字机效果
});

// 批量执行命令
const commands = ['ls', 'pwd', 'whoami'];
for (const cmd of commands) {
    await terminal.execute(cmd);
}

// 延迟执行
setTimeout(() => {
    terminal.execute('date');
}, 3000);
```

---

## 🔌 后端 API 接口规范

CoolTerminal 需要后端提供命令执行接口：

### 请求格式

```http
POST /api/terminal/execute
Content-Type: application/json

{
    "command": "ls -la"
}
```

### 响应格式

成功：
```json
{
    "success": true,
    "output": "文件列表...",
    "exit_code": 0
}
```

失败：
```json
{
    "success": false,
    "error": "命令未找到",
    "output": "错误详情",
    "exit_code": 1
}
```

### Python Flask 示例

```python
from flask import Flask, request, jsonify
import subprocess

app = Flask(__name__)

@app.route('/api/terminal/execute', methods=['POST'])
def execute_command():
    data = request.json
    command = data.get('command', '')

    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30
        )

        return jsonify({
            'success': result.returncode == 0,
            'output': result.stdout or result.stderr,
            'exit_code': result.returncode
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'exit_code': -1
        })

if __name__ == '__main__':
    app.run(port=5000)
```

### Node.js Express 示例

```javascript
const express = require('express');
const { exec } = require('child_process');

const app = express();
app.use(express.json());

app.post('/api/terminal/execute', (req, res) => {
    const { command } = req.body;

    exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
            return res.json({
                success: false,
                output: stderr || error.message,
                exit_code: error.code || -1
            });
        }

        res.json({
            success: true,
            output: stdout,
            exit_code: 0
        });
    });
});

app.listen(5000, () => {
    console.log('Server running on port 5000');
});
```

---

## 📝 完整示例

### 示例：监控日志查看器

```html
<!DOCTYPE html>
<html>
<head>
    <title>日志监控终端</title>
    <style>
        body { margin: 0; font-family: sans-serif; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .controls { margin-bottom: 20px; }
        button { padding: 10px 20px; margin-right: 10px; }
        #terminal { height: 600px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>服务器日志监控</h1>
        <div class="controls">
            <button onclick="viewLogs()">查看日志</button>
            <button onclick="clearTerminal()">清空</button>
            <button onclick="checkStatus()">检查状态</button>
        </div>
        <div id="terminal"></div>
    </div>

    <script src="./static/js/coolterminal.module.js"></script>
    <script>
        const terminal = CoolTerminal.create({
            container: '#terminal',
            theme: 'dark',
            apiEndpoint: 'http://localhost:5000/api/terminal/execute',
            welcomeMessage: '=== 服务器日志监控系统 ===\n输入命令或点击上方按钮'
        });

        // 监听命令执行
        terminal.on('output', (data) => {
            if (data.exitCode !== 0) {
                console.error('命令执行失败');
            }
        });

        function viewLogs() {
            terminal.execute('tail -n 50 /var/log/app.log');
        }

        function clearTerminal() {
            terminal.clear();
        }

        function checkStatus() {
            terminal.execute('systemctl status myapp');
        }
    </script>
</body>
</html>
```

---

## 🎓 TypeScript 支持

```typescript
import CoolTerminal, { CoolTerminalOptions, ExecutionResult } from 'coolterminal';

const options: CoolTerminalOptions = {
    container: '#terminal',
    theme: 'dark',
    typingSpeed: 20
};

const terminal = CoolTerminal.create(options);

terminal.on('command', (data) => {
    console.log(data.command);
});

const result: ExecutionResult = await terminal.execute('ls');
```

---

## 📚 更多资源

- [完整 API 文档](./API.md)
- [示例项目](./examples/)
- [常见问题](./FAQ.md)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
