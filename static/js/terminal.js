// ==== terminal.js - 多终端实例管理 ====

// 单个终端实例类
class Terminal {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.historyCommands = []; // 命令历史（最多50条，不重复）
        this.historyIndex = -1; // 当前历史索引（用于上下键导航）
        this.commandHistory = []; // 用于上下键导航的完整历史
        this.isTyping = false; // 是否正在打字
        this.typingSpeed = 20; // 打字速度（毫秒）
        this.outputHtml = ''; // 终端输出的 HTML

        // 加载历史
        this.loadHistory();
    }

    // 执行命令
    async executeCommand(command) {
        if (this.isTyping) return;
        if (!command.trim()) return;

        // 添加命令到输出
        this.addCommandLine(command);

        // 添加到历史记录（不重复）
        this.addToHistory(command);

        // 重置历史导航索引
        this.historyIndex = -1;

        // 执行真实命令
        await this.executeRealCommand(command);
    }

    // 添加命令行到输出
    addCommandLine(command) {
        this.outputHtml += `
            <div class="terminal-line">
                <span class="terminal-prompt">$</span>
                <span class="terminal-command">${this.escapeHtml(command)}</span>
            </div>
        `;
    }

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
    }

    // 打字机效果输出
    async typeOutput(text, className = '') {
        this.isTyping = true;

        const lineId = `line-${Date.now()}-${Math.random()}`;
        this.outputHtml += `
            <div class="terminal-line">
                <span class="terminal-result ${className}" id="${lineId}"></span>
            </div>
        `;

        // 更新 DOM
        TerminalManager.updateCurrentTerminalOutput();

        const resultSpan = document.getElementById(lineId);
        if (resultSpan) {
            // 逐字符显示
            for (let i = 0; i < text.length; i++) {
                resultSpan.textContent += text[i];
                TerminalManager.scrollToBottom();
                await this.sleep(this.typingSpeed);
            }
        }

        this.isTyping = false;
    }

    // 立即输出（不使用打字机效果）
    addOutput(text, className = '') {
        this.outputHtml += `
            <div class="terminal-line">
                <span class="terminal-result ${className}">${this.escapeHtml(text)}</span>
            </div>
        `;
    }

    // 清空屏幕
    clear() {
        this.outputHtml = '';
    }

    // 历史记录管理
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
    }

    navigateHistory(direction, input) {
        if (this.commandHistory.length === 0) return;

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
    }

    clearHistory() {
        if (!confirm('确定要清空所有命令历史吗？')) {
            return;
        }

        this.historyCommands = [];
        this.commandHistory = [];
        this.historyIndex = -1;
        this.saveHistory();
    }

    // 本地存储
    saveHistory() {
        try {
            localStorage.setItem(`terminal_history_${this.id}`, JSON.stringify(this.historyCommands));
            localStorage.setItem(`terminal_command_history_${this.id}`, JSON.stringify(this.commandHistory));
        } catch (e) {
            console.error('保存历史记录失败:', e);
        }
    }

    loadHistory() {
        try {
            const history = localStorage.getItem(`terminal_history_${this.id}`);
            if (history) {
                this.historyCommands = JSON.parse(history);
            }

            const commandHistory = localStorage.getItem(`terminal_command_history_${this.id}`);
            if (commandHistory) {
                this.commandHistory = JSON.parse(commandHistory);
            }
        } catch (e) {
            console.error('加载历史记录失败:', e);
            this.historyCommands = [];
            this.commandHistory = [];
        }
    }

    // 工具方法
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 终端管理器
const TerminalManager = {
    terminals: [], // 所有终端实例
    currentTerminalId: null, // 当前激活的终端 ID
    nextId: 1, // 下一个终端 ID
    isInitialized: false,

    // 初始化
    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        // 创建第一个终端
        this.createNewTerminal();

        // 设置输入框事件
        this.setupInputEvents();

        // 渲染 feather 图标
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    },

    // 设置输入框事件
    setupInputEvents() {
        const input = document.getElementById('terminalInput');
        if (!input) return;

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleCommand();
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
    },

    // 创建新终端
    createNewTerminal() {
        const id = this.nextId++;
        const name = `终端 ${id}`;
        const terminal = new Terminal(id, name);

        this.terminals.push(terminal);

        // 添加欢迎消息
        terminal.outputHtml = `
            <div class="terminal-line welcome-message">
                <span class="terminal-prompt">$</span>
                <span class="terminal-text">欢迎使用 CoolTerminal - 现代化终端模拟器</span>
            </div>
            <div class="terminal-line">
                <span class="terminal-prompt">$</span>
                <span class="terminal-text">输入命令执行，或查看右上角的命令参考手册</span>
            </div>
        `;

        // 切换到新终端
        this.switchTerminal(id);

        // 更新 UI
        this.updateTerminalTabs();

        return terminal;
    },

    // 切换终端
    switchTerminal(id) {
        this.currentTerminalId = id;
        this.updateCurrentTerminalOutput();
        this.updateHistoryPanel();
        this.updateTerminalTabs();

        // 聚焦输入框
        const input = document.getElementById('terminalInput');
        if (input) {
            input.focus();
        }
    },

    // 关闭终端
    closeTerminal(id) {
        // 至少保留一个终端
        if (this.terminals.length <= 1) {
            alert('至少需要保留一个终端');
            return;
        }

        const index = this.terminals.findIndex(t => t.id === id);
        if (index === -1) return;

        // 删除终端
        this.terminals.splice(index, 1);

        // 如果关闭的是当前终端，切换到其他终端
        if (this.currentTerminalId === id) {
            const newTerminal = this.terminals[Math.min(index, this.terminals.length - 1)];
            this.switchTerminal(newTerminal.id);
        }

        // 更新 UI
        this.updateTerminalTabs();
    },

    // 获取当前终端
    getCurrentTerminal() {
        return this.terminals.find(t => t.id === this.currentTerminalId);
    },

    // 处理命令
    async handleCommand() {
        const input = document.getElementById('terminalInput');
        const command = input.value.trim();

        if (!command) return;

        const terminal = this.getCurrentTerminal();
        if (!terminal) return;

        // 清空输入
        input.value = '';

        // 执行命令
        await terminal.executeCommand(command);

        // 更新输出
        this.updateCurrentTerminalOutput();
        this.updateHistoryPanel();
    },

    // 历史导航
    navigateHistory(direction) {
        const terminal = this.getCurrentTerminal();
        if (!terminal) return;

        const input = document.getElementById('terminalInput');
        if (!input) return;

        terminal.navigateHistory(direction, input);
    },

    // 更新当前终端输出
    updateCurrentTerminalOutput() {
        const terminal = this.getCurrentTerminal();
        if (!terminal) return;

        const output = document.getElementById('terminalOutput');
        if (output) {
            output.innerHTML = terminal.outputHtml;
            this.scrollToBottom();
        }
    },

    // 更新历史面板
    updateHistoryPanel() {
        const terminal = this.getCurrentTerminal();
        if (!terminal) return;

        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        if (terminal.historyCommands.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <i data-feather="terminal" style="width: 32px; height: 32px; opacity: 0.3;"></i>
                    <p>暂无命令历史</p>
                </div>
            `;
            if (typeof feather !== 'undefined') feather.replace();
            return;
        }

        historyList.innerHTML = terminal.historyCommands.map((cmd) => {
            const escapedCmd = terminal.escapeHtml(cmd).replace(/'/g, "\\'");
            return `
                <div class="history-item" onclick="TerminalManager.executeFromHistory('${escapedCmd}')">
                    <div class="history-item-content">
                        <div class="history-command">${terminal.escapeHtml(cmd)}</div>
                        <div class="history-time">最近使用</div>
                    </div>
                </div>
            `;
        }).join('');

        if (typeof feather !== 'undefined') feather.replace();
    },

    // 更新终端标签列表
    updateTerminalTabs() {
        const tabsList = document.getElementById('terminalTabsList');
        if (!tabsList) return;

        tabsList.innerHTML = this.terminals.map(terminal => {
            const isActive = terminal.id === this.currentTerminalId;
            return `
                <button class="terminal-tab-item ${isActive ? 'active' : ''}"
                        onclick="TerminalManager.switchTerminal(${terminal.id})">
                    <div class="terminal-tab-icon">
                        <i data-feather="terminal"></i>
                    </div>
                    <span class="terminal-tab-name">${terminal.name}</span>
                    <button class="terminal-tab-close"
                            onclick="event.stopPropagation(); TerminalManager.closeTerminal(${terminal.id})">
                        <i data-feather="x"></i>
                    </button>
                </button>
            `;
        }).join('');

        if (typeof feather !== 'undefined') feather.replace();
    },

    // 从历史执行命令
    executeFromHistory(command) {
        const input = document.getElementById('terminalInput');
        if (input) {
            input.value = command;
            input.focus();
        }
    },

    // 切换历史面板
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

    // 清空历史
    clearHistory() {
        const terminal = this.getCurrentTerminal();
        if (!terminal) return;

        terminal.clearHistory();
        this.updateHistoryPanel();
    },

    // 清空屏幕
    clearScreen() {
        const terminal = this.getCurrentTerminal();
        if (!terminal) return;

        terminal.clear();
        this.updateCurrentTerminalOutput();
    },

    // 滚动到底部
    scrollToBottom() {
        const output = document.getElementById('terminalOutput');
        if (output) {
            output.scrollTop = output.scrollHeight;
        }
    }
};
