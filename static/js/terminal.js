// ==== terminal.js - 终端功能 ====

const TerminalManager = {
    historyCommands: [], // 命令历史（最多50条，不重复）
    historyIndex: -1, // 当前历史索引（用于上下键导航）
    commandHistory: [], // 用于上下键导航的完整历史
    isTyping: false, // 是否正在打字
    typingSpeed: 20, // 打字速度（毫秒）
    useRealCommands: false, // 是否使用真实命令（默认模拟）

    init() {
        const input = document.getElementById('terminalInput');
        if (!input) return;

        // 加载历史命令
        this.loadHistory();

        // 键盘事件
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.executeCommand();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory('up');
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory('down');
            }
        });

        // 自动聚焦
        input.focus();

        // 点击终端区域自动聚焦输入框
        const terminalMain = document.getElementById('terminalMain');
        if (terminalMain) {
            terminalMain.addEventListener('click', () => {
                input.focus();
            });
        }

        // 渲染历史记录
        this.renderHistory();

        // 重新渲染 feather 图标
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    },

    // 执行命令
    async executeCommand() {
        if (this.isTyping) return;

        const input = document.getElementById('terminalInput');
        const command = input.value.trim();

        if (!command) return;

        // 添加命令到输出
        this.addCommandLine(command);

        // 清空输入
        input.value = '';

        // 添加到历史记录（不重复）
        this.addToHistory(command);

        // 重置历史导航索引
        this.historyIndex = -1;

        // 执行命令
        await this.runCommand(command);

        // 滚动到底部
        this.scrollToBottom();
    },

    // 添加命令行到输出
    addCommandLine(command) {
        const output = document.getElementById('terminalOutput');
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = `
            <span class="terminal-prompt">$</span>
            <span class="terminal-command">${this.escapeHtml(command)}</span>
        `;
        output.appendChild(line);
    },

    // 运行命令
    async runCommand(command) {
        // 如果启用真实命令模式，调用后端 API
        if (this.useRealCommands) {
            await this.executeRealCommand(command);
            return;
        }

        // 否则使用模拟命令
        const [cmd, ...args] = command.split(' ');
        const cmdLower = cmd.toLowerCase();

        // 内置命令
        const commands = {
            help: () => this.cmdHelp(),
            clear: () => this.cmdClear(),
            cls: () => this.cmdClear(),
            echo: () => this.cmdEcho(args.join(' ')),
            date: () => this.cmdDate(),
            time: () => this.cmdTime(),
            whoami: () => this.cmdWhoami(),
            about: () => this.cmdAbout(),
            history: () => this.cmdHistory(),
            ls: () => this.cmdLs(),
            pwd: () => this.cmdPwd(),
            version: () => this.cmdVersion(),
            uname: () => this.cmdUname(),
            sysinfo: () => this.cmdSysinfo(),
        };

        if (commands[cmdLower]) {
            await commands[cmdLower]();
        } else {
            await this.cmdNotFound(cmd);
        }
    },

    // 执行真实命令（调用后端 API）
    async executeRealCommand(command) {
        try {
            this.isTyping = true;
            const response = await fetch('/api/terminal/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command: command })
            });

            const data = await response.json();

            if (data.success) {
                // 显示命令输出
                const output = data.output || '命令执行成功（无输出）';
                const className = data.exit_code === 0 ? 'success' : 'warning';
                await this.typeOutput(output, className);
            } else {
                // 显示错误
                await this.typeOutput(data.output || data.error, 'error');
            }
        } catch (error) {
            await this.typeOutput(`连接错误: ${error.message}`, 'error');
            await this.typeOutput('提示：请确保 Python 后端正在运行');
        } finally {
            this.isTyping = false;
        }
    },

    // 切换命令模式（模拟 / 真实）
    toggleMode() {
        this.useRealCommands = !this.useRealCommands;

        // 更新 UI
        const modeBadge = document.getElementById('terminalModeBadge');
        const modeToggleText = document.getElementById('modeToggleText');
        const modeToggleBtn = document.getElementById('modeToggleBtn');

        if (this.useRealCommands) {
            modeBadge.textContent = '真实模式';
            modeBadge.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(16, 185, 129, 0.1))';
            modeBadge.style.borderColor = 'rgba(34, 197, 94, 0.3)';
            modeBadge.style.color = 'var(--success)';
            modeToggleText.textContent = '切换到模拟模式';
            modeToggleBtn.querySelector('i').setAttribute('data-feather', 'toggle-right');
        } else {
            modeBadge.textContent = '模拟模式';
            modeBadge.style.background = 'var(--surface-glass)';
            modeBadge.style.borderColor = 'var(--border-glass)';
            modeBadge.style.color = 'var(--text-secondary)';
            modeToggleText.textContent = '切换到真实模式';
            modeToggleBtn.querySelector('i').setAttribute('data-feather', 'toggle-left');
        }

        // 重新渲染图标
        if (typeof feather !== 'undefined') {
            feather.replace();
        }

        // 显示提示
        const modeText = this.useRealCommands ? '真实命令' : '模拟命令';
        this.addOutput(`已切换到 ${modeText} 模式`, 'success');
    },

    // 打字机效果输出
    async typeOutput(text, className = '') {
        this.isTyping = true;
        const output = document.getElementById('terminalOutput');
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = `<span class="terminal-result ${className}"></span>`;
        output.appendChild(line);

        const resultSpan = line.querySelector('.terminal-result');

        // 逐字符显示
        for (let i = 0; i < text.length; i++) {
            resultSpan.textContent += text[i];
            this.scrollToBottom();
            await this.sleep(this.typingSpeed);
        }

        this.isTyping = false;
    },

    // 立即输出（不使用打字机效果）
    addOutput(text, className = '') {
        const output = document.getElementById('terminalOutput');
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = `<span class="terminal-result ${className}">${this.escapeHtml(text)}</span>`;
        output.appendChild(line);
    },

    // 添加HTML输出
    addHtmlOutput(html) {
        const output = document.getElementById('terminalOutput');
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = html;
        output.appendChild(line);
    },

    // === 命令实现 ===

    async cmdHelp() {
        await this.typeOutput('可用命令列表：', 'success');

        const helpList = `
<div class="command-help-list">
    <div class="command-help-item">
        <span class="command-help-name">help</span>
        <span class="command-help-desc">显示帮助信息</span>
    </div>
    <div class="command-help-item">
        <span class="command-help-name">clear / cls</span>
        <span class="command-help-desc">清空终端屏幕</span>
    </div>
    <div class="command-help-item">
        <span class="command-help-name">echo [text]</span>
        <span class="command-help-desc">输出文本</span>
    </div>
    <div class="command-help-item">
        <span class="command-help-name">date</span>
        <span class="command-help-desc">显示当前日期</span>
    </div>
    <div class="command-help-item">
        <span class="command-help-name">time</span>
        <span class="command-help-desc">显示当前时间</span>
    </div>
    <div class="command-help-item">
        <span class="command-help-name">whoami</span>
        <span class="command-help-desc">显示当前用户</span>
    </div>
    <div class="command-help-item">
        <span class="command-help-name">pwd</span>
        <span class="command-help-desc">显示当前目录</span>
    </div>
    <div class="command-help-item">
        <span class="command-help-name">ls</span>
        <span class="command-help-desc">列出文件</span>
    </div>
    <div class="command-help-item">
        <span class="command-help-name">version</span>
        <span class="command-help-desc">显示版本信息</span>
    </div>
    <div class="command-help-item">
        <span class="command-help-name">about</span>
        <span class="command-help-desc">关于 CoolTerminal</span>
    </div>
    <div class="command-help-item">
        <span class="command-help-name">history</span>
        <span class="command-help-desc">显示命令历史</span>
    </div>
    <div class="command-help-item">
        <span class="command-help-name">sysinfo</span>
        <span class="command-help-desc">显示系统信息</span>
    </div>
</div>`;

        this.addHtmlOutput(helpList);
    },

    async cmdClear() {
        const output = document.getElementById('terminalOutput');
        output.innerHTML = '';
    },

    async cmdEcho(text) {
        if (!text) {
            this.addOutput('');
        } else {
            await this.typeOutput(text);
        }
    },

    async cmdDate() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
        await this.typeOutput(dateStr, 'success');
    },

    async cmdTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        await this.typeOutput(timeStr, 'success');
    },

    async cmdWhoami() {
        await this.typeOutput('CoolTerminal User', 'success');
    },

    async cmdAbout() {
        await this.typeOutput('CoolTerminal v1.0.0', 'success');
        await this.typeOutput('现代化终端模拟器 - 支持命令历史、打字机效果等功能');
        await this.typeOutput('Made with ❤️ by Claude');
    },

    async cmdPwd() {
        await this.typeOutput('/home/user/coolterminal', 'success');
    },

    async cmdLs() {
        const files = [
            { name: 'documents', type: 'dir', size: '-' },
            { name: 'downloads', type: 'dir', size: '-' },
            { name: 'projects', type: 'dir', size: '-' },
            { name: 'readme.txt', type: 'file', size: '2.4 KB' },
            { name: 'config.json', type: 'file', size: '1.2 KB' },
        ];

        const tableHtml = `
<table class="terminal-table">
    <thead>
        <tr>
            <th>名称</th>
            <th>类型</th>
            <th>大小</th>
        </tr>
    </thead>
    <tbody>
        ${files.map(f => `
            <tr>
                <td>${f.name}</td>
                <td>${f.type}</td>
                <td>${f.size}</td>
            </tr>
        `).join('')}
    </tbody>
</table>`;

        this.addHtmlOutput(tableHtml);
    },

    async cmdVersion() {
        await this.typeOutput('CoolTerminal 1.0.0', 'success');
        await this.typeOutput('Build: 2024.01.05');
        await this.typeOutput('Node: Electron');
    },

    async cmdUname() {
        const platform = navigator.platform;
        const userAgent = navigator.userAgent;
        await this.typeOutput(`Platform: ${platform}`, 'success');
        await this.typeOutput(`User Agent: ${userAgent}`);
    },

    async cmdSysinfo() {
        await this.typeOutput('=== 系统信息 ===', 'success');
        await this.typeOutput(`平台: ${navigator.platform}`);
        await this.typeOutput(`语言: ${navigator.language}`);
        await this.typeOutput(`在线状态: ${navigator.onLine ? '在线' : '离线'}`);
        await this.typeOutput(`屏幕分辨率: ${screen.width}x${screen.height}`);
        await this.typeOutput(`CPU核心数: ${navigator.hardwareConcurrency || '未知'}`);
    },

    async cmdHistory() {
        if (this.historyCommands.length === 0) {
            await this.typeOutput('暂无命令历史', 'warning');
            return;
        }

        await this.typeOutput('命令历史记录：', 'success');
        this.historyCommands.forEach((cmd, index) => {
            this.addOutput(`  ${index + 1}. ${cmd}`);
        });
    },

    async cmdNotFound(cmd) {
        await this.typeOutput(`命令未找到: ${cmd}`, 'error');
        await this.typeOutput('输入 help 查看可用命令');
    },

    // === 历史记录管理 ===

    addToHistory(command) {
        // 检查是否已存在（不重复）
        const existingIndex = this.historyCommands.indexOf(command);
        if (existingIndex !== -1) {
            // 如果已存在，移除旧的
            this.historyCommands.splice(existingIndex, 1);
        }

        // 添加到开头
        this.historyCommands.unshift(command);

        // 限制最多50条
        if (this.historyCommands.length > 50) {
            this.historyCommands = this.historyCommands.slice(0, 50);
        }

        // 同时更新完整历史（用于上下键导航）
        this.commandHistory.push(command);
        if (this.commandHistory.length > 100) {
            this.commandHistory.shift();
        }

        // 保存到 localStorage
        this.saveHistory();

        // 渲染历史记录
        this.renderHistory();
    },

    navigateHistory(direction) {
        if (this.commandHistory.length === 0) return;

        const input = document.getElementById('terminalInput');

        if (direction === 'up') {
            this.historyIndex++;
            if (this.historyIndex >= this.commandHistory.length) {
                this.historyIndex = this.commandHistory.length - 1;
            }
        } else if (direction === 'down') {
            this.historyIndex--;
            if (this.historyIndex < -1) {
                this.historyIndex = -1;
            }
        }

        if (this.historyIndex === -1) {
            input.value = '';
        } else {
            const cmd = this.commandHistory[this.commandHistory.length - 1 - this.historyIndex];
            input.value = cmd;
        }
    },

    renderHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        if (this.historyCommands.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <i data-feather="terminal" style="width: 32px; height: 32px; opacity: 0.3;"></i>
                    <p>暂无命令历史</p>
                </div>
            `;
            if (typeof feather !== 'undefined') feather.replace();
            return;
        }

        historyList.innerHTML = this.historyCommands.map((cmd, index) => {
            return `
                <div class="history-item" onclick="TerminalManager.executeFromHistory('${this.escapeHtml(cmd)}')">
                    <div class="history-item-content">
                        <div class="history-command">${this.escapeHtml(cmd)}</div>
                        <div class="history-time">最近使用</div>
                    </div>
                </div>
            `;
        }).join('');

        if (typeof feather !== 'undefined') feather.replace();
    },

    executeFromHistory(command) {
        const input = document.getElementById('terminalInput');
        input.value = command;
        input.focus();
    },

    toggleHistory() {
        const panel = document.getElementById('historyPanel');
        if (!panel) return;

        panel.classList.toggle('hidden');

        // 更新按钮状态
        const btn = document.getElementById('historyToggleBtn');
        if (btn) {
            if (panel.classList.contains('hidden')) {
                btn.style.opacity = '0.6';
            } else {
                btn.style.opacity = '1';
            }
        }
    },

    clearHistory() {
        if (!confirm('确定要清空所有命令历史吗？')) {
            return;
        }

        this.historyCommands = [];
        this.commandHistory = [];
        this.historyIndex = -1;
        this.saveHistory();
        this.renderHistory();

        this.addOutput('命令历史已清空', 'success');
    },

    // === 工具方法 ===

    clearScreen() {
        this.cmdClear();
    },

    scrollToBottom() {
        const output = document.getElementById('terminalOutput');
        if (output) {
            output.scrollTop = output.scrollHeight;
        }
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    // === 本地存储 ===

    saveHistory() {
        try {
            localStorage.setItem('terminal_history', JSON.stringify(this.historyCommands));
            localStorage.setItem('terminal_command_history', JSON.stringify(this.commandHistory));
        } catch (e) {
            console.error('保存历史记录失败:', e);
        }
    },

    loadHistory() {
        try {
            const history = localStorage.getItem('terminal_history');
            if (history) {
                this.historyCommands = JSON.parse(history);
            }

            const commandHistory = localStorage.getItem('terminal_command_history');
            if (commandHistory) {
                this.commandHistory = JSON.parse(commandHistory);
            }
        } catch (e) {
            console.error('加载历史记录失败:', e);
            this.historyCommands = [];
            this.commandHistory = [];
        }
    }
};
