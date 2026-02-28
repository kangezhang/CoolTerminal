// ==== terminal.js - WebSocket 实时终端 ====

// ============ ANSI 转义码渲染器 ============
const AnsiRenderer = {
    // ANSI 颜色映射（标准16色）
    fgColors: {
        30: '#4c4c4c', 31: '#ff5555', 32: '#55ff55', 33: '#ffff55',
        34: '#5555ff', 35: '#ff55ff', 36: '#55ffff', 37: '#cccccc',
        90: '#888888', 91: '#ff8888', 92: '#88ff88', 93: '#ffff88',
        94: '#8888ff', 95: '#ff88ff', 96: '#88ffff', 97: '#ffffff'
    },
    bgColors: {
        40: '#000000', 41: '#aa0000', 42: '#00aa00', 43: '#aa5500',
        44: '#0000aa', 45: '#aa00aa', 46: '#00aaaa', 47: '#aaaaaa',
        100: '#555555', 101: '#ff5555', 102: '#55ff55', 103: '#ffff55',
        104: '#5555ff', 105: '#ff55ff', 106: '#55ffff', 107: '#ffffff'
    },

    /**
     * 将含 ANSI 转义码的文本转换为 HTML
     */
    render(text) {
        // 先做 HTML 转义（防 XSS），再处理 ANSI
        const escaped = this._escapeHtml(text);
        return this._parseAnsi(escaped);
    },

    _escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    _parseAnsi(text) {
        // 匹配 ESC[ ... m 序列
        const ansiRegex = /\x1b\[([0-9;]*)m/g;
        let result = '';
        let lastIndex = 0;
        let openSpans = 0;
        let match;

        while ((match = ansiRegex.exec(text)) !== null) {
            // 添加转义序列之前的文本
            result += text.slice(lastIndex, match.index);
            lastIndex = match.index + match[0].length;

            const codes = match[1].split(';').map(Number);
            const styles = [];
            let closeAll = false;

            for (const code of codes) {
                if (code === 0 || isNaN(code)) {
                    closeAll = true;
                } else if (code === 1) {
                    styles.push('font-weight:bold');
                } else if (code === 2) {
                    styles.push('opacity:0.7');
                } else if (code === 3) {
                    styles.push('font-style:italic');
                } else if (code === 4) {
                    styles.push('text-decoration:underline');
                } else if (code === 7) {
                    // 反色：简单处理
                    styles.push('filter:invert(1)');
                } else if (this.fgColors[code]) {
                    styles.push(`color:${this.fgColors[code]}`);
                } else if (this.bgColors[code]) {
                    styles.push(`background:${this.bgColors[code]}`);
                } else if (code >= 38 && code <= 39) {
                    // 256色/真彩色：跳过（复杂，暂不处理）
                }
            }

            if (closeAll && openSpans > 0) {
                result += '</span>'.repeat(openSpans);
                openSpans = 0;
            }

            if (styles.length > 0) {
                result += `<span style="${styles.join(';')}">`;
                openSpans++;
            }
        }

        // 添加剩余文本
        result += text.slice(lastIndex);

        // 关闭未关闭的 span
        if (openSpans > 0) {
            result += '</span>'.repeat(openSpans);
        }

        // 过滤掉其他 ANSI 控制序列（光标移动等，不渲染）
        result = result.replace(/\x1b\[[0-9;]*[A-HJKSTfhilmnprsu]/g, '');
        result = result.replace(/\x1b\][^\x07]*\x07/g, ''); // OSC 序列
        result = result.replace(/\x1b[()][AB012]/g, '');    // 字符集切换

        return result;
    }
};

// ============ 单个终端实例 ============
class Terminal {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.historyIndex = -1;
        this.outputHtml = '';
        this.isRunning = false;   // 是否有命令在执行
        this.cwd = '';            // 当前工作目录（由后端维护）
        this.tabCandidates = [];  // Tab 补全候选
        this.tabIndex = -1;       // 当前 Tab 候选索引
        this.tabOriginal = '';    // Tab 补全前的原始输入
        this._cmdTimeout = null;  // 超时计时器
    }

    // 强制解锁终端（断线/超时时调用）
    forceUnlock(message = '') {
        if (this._cmdTimeout) { clearTimeout(this._cmdTimeout); this._cmdTimeout = null; }
        if (message) {
            this.outputHtml += `<div class="terminal-line"><span class="terminal-result warning">${AnsiRenderer._escapeHtml(message)}</span></div>`;
        }
        // 直接复位，不走 finalizeOutput（避免循环）
        const streamId = `stream-${this.id}`;
        const el = document.getElementById(streamId);
        if (el) el.removeAttribute('id');
        this.outputHtml = this.outputHtml.replace(new RegExp(`id="${streamId}"`), '');
        this.isRunning = false;
    }

    // 添加命令行到输出
    addCommandLine(command) {
        this.outputHtml += `
            <div class="terminal-line">
                <span class="terminal-prompt">${this._getCwdPrompt()}</span>
                <span class="terminal-command">${AnsiRenderer._escapeHtml(command)}</span>
            </div>
        `;
    }

    // 追加输出内容（流式）
    appendOutput(text, type = 'output') {
        const html = AnsiRenderer.render(text);
        const streamId = `stream-${this.id}`;
        const existing = document.getElementById(streamId);

        if (existing) {
            // 直接追加到 DOM，同时同步到 outputHtml
            existing.innerHTML += html;
            // 同步更新 outputHtml 中对应的内容
            this._syncStreamToHtml(streamId, existing.innerHTML);
        } else {
            // 新建流式行
            this.outputHtml += `<div class="terminal-line"><span class="terminal-result ${type}" id="${streamId}">${html}</span></div>`;
            TerminalManager.updateCurrentTerminalOutput();
        }
        TerminalManager.scrollToBottom();
    }

    // 将 DOM 中流式行的内容同步回 outputHtml
    _syncStreamToHtml(streamId, innerHTML) {
        const regex = new RegExp(`(<span[^>]*id="${streamId}"[^>]*>)[\\s\\S]*?(</span>)`);
        this.outputHtml = this.outputHtml.replace(regex, `$1${innerHTML}$2`);
    }

    // 命令完成，关闭流式行
    finalizeOutput() {
        // 移除流式行的 id，防止下次命令继续追加
        const streamId = `stream-${this.id}`;
        const el = document.getElementById(streamId);
        if (el) {
            // 同步最终内容到 outputHtml
            this._syncStreamToHtml(streamId, el.innerHTML);
            el.removeAttribute('id');
        }
        // 同时清理 outputHtml 中的 id
        this.outputHtml = this.outputHtml.replace(new RegExp(`id="${streamId}"`), '');
        this.isRunning = false;
        TerminalManager.updateInputState();
    }

    // 清空屏幕
    clear() {
        this.outputHtml = '';
        // 移除 DOM 中的流式行 id
        const el = document.getElementById(`stream-${this.id}`);
        if (el) el.removeAttribute('id');
    }

    // 历史导航
    navigateHistory(direction, input) {
        const history = TerminalManager.getGlobalCommandHistory();
        if (history.length === 0) return;

        if (direction === 'up') {
            this.historyIndex = Math.min(this.historyIndex + 1, history.length - 1);
        } else {
            this.historyIndex = Math.max(this.historyIndex - 1, -1);
        }

        input.value = this.historyIndex === -1 ? '' : history[history.length - 1 - this.historyIndex];
        // 光标移到末尾
        setTimeout(() => { input.selectionStart = input.selectionEnd = input.value.length; }, 0);
    }

    // Tab 补全
    handleTab(input, completions) {
        if (completions.length === 0) return;

        if (completions.length === 1) {
            // 唯一候选，直接补全
            const parts = input.value.split(' ');
            parts[parts.length - 1] = completions[0];
            input.value = parts.join(' ');
            this.tabCandidates = [];
            this.tabIndex = -1;
        } else {
            // 多个候选，循环切换
            if (this.tabCandidates.length === 0 || this.tabOriginal !== input.value) {
                this.tabCandidates = completions;
                this.tabOriginal = input.value;
                this.tabIndex = -1;
            }
            this.tabIndex = (this.tabIndex + 1) % this.tabCandidates.length;
            const parts = this.tabOriginal.split(' ');
            parts[parts.length - 1] = this.tabCandidates[this.tabIndex];
            input.value = parts.join(' ');

            // 显示候选列表
            this._showTabHints(completions);
        }
    }

    _showTabHints(completions) {
        const hintId = `tab-hint-${this.id}`;
        // 移除旧的提示
        const old = document.getElementById(hintId);
        if (old) old.parentElement.remove();

        const hint = completions.slice(0, 10).join('  ');
        this.outputHtml += `
            <div class="terminal-line tab-hint-line" id="${hintId}-wrap">
                <span class="terminal-result tab-hint" id="${hintId}">${AnsiRenderer._escapeHtml(hint)}</span>
            </div>
        `;
        TerminalManager.updateCurrentTerminalOutput();
        TerminalManager.scrollToBottom();
    }

    clearTabHints() {
        this.outputHtml = this.outputHtml.replace(
            /<div class="terminal-line tab-hint-line"[^>]*>[\s\S]*?<\/div>/g, ''
        );
        this.tabCandidates = [];
        this.tabIndex = -1;
    }

    _getCwdPrompt() {
        if (!this.cwd) return '>';
        // 只显示最后一级目录名
        const parts = this.cwd.replace(/\\/g, '/').split('/').filter(Boolean);
        const dir = parts[parts.length - 1] || this.cwd;
        return `${dir}>`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============ 终端管理器 ============
const TerminalManager = {
    terminals: [],
    currentTerminalId: null,
    nextId: 1,
    isInitialized: false,
    socket: null,

    globalHistoryCommands: [],
    globalCommandHistory: [],

    // 初始化
    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;

        this.loadGlobalHistory();
        this._connectWebSocket();
        this.createNewTerminal();
        this.setupInputEvents();

        if (typeof feather !== 'undefined') feather.replace();
    },

    // 建立 WebSocket 连接
    _connectWebSocket() {
        if (typeof io === 'undefined') {
            console.warn('Socket.IO 未加载，将使用 REST 降级模式');
            return;
        }

        this.socket = io({
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        this.socket.on('connect', () => {
            console.log('WebSocket 已连接:', this.socket.id);
            this._setConnectionStatus('connected');
            // 重连后解锁所有卡住的终端
            this.terminals.forEach(t => { if (t.isRunning) t.forceUnlock(); });
            this.updateInputState();
        });

        this.socket.on('disconnect', (reason) => {
            console.warn('WebSocket 断开:', reason);
            this._setConnectionStatus('disconnected');
            // 断线立即解锁所有终端，避免输入框永久禁用
            this.terminals.forEach(t => { if (t.isRunning) t.forceUnlock('连接断开\r\n'); });
            this.updateInputState();
        });

        this.socket.on('connect_error', (err) => {
            console.error('WebSocket 连接失败:', err.message);
            this._setConnectionStatus('error');
        });

        // 流式输出
        this.socket.on('output', (data) => {
            const terminal = this.terminals.find(t => t.id === data.terminal_id);
            if (!terminal) return;
            terminal.appendOutput(data.data, data.type || 'output');
            if (this.currentTerminalId === data.terminal_id) {
                this.updateCurrentTerminalOutput();
            }
        });

        // 命令执行完成
        this.socket.on('command_done', (data) => {
            const terminal = this.terminals.find(t => t.id === data.terminal_id);
            if (!terminal) return;
            // 清除该终端的超时计时器
            if (terminal._cmdTimeout) { clearTimeout(terminal._cmdTimeout); terminal._cmdTimeout = null; }
            terminal.finalizeOutput();
            if (data.cwd) terminal.cwd = data.cwd;
            if (this.currentTerminalId === data.terminal_id) {
                this.updateCurrentTerminalOutput();
                this.updatePrompt();
            }
        });

        // Tab 补全结果
        this.socket.on('tab_completions', (data) => {
            const terminal = this.terminals.find(t => t.id === data.terminal_id);
            if (!terminal) return;
            const input = document.getElementById('terminalInput');
            if (input) terminal.handleTab(input, data.completions);
        });

        // cwd 更新
        this.socket.on('cwd_update', (data) => {
            const terminal = this.terminals.find(t => t.id === data.terminal_id);
            if (terminal) {
                terminal.cwd = data.cwd;
                if (this.currentTerminalId === data.terminal_id) this.updatePrompt();
            }
        });
    },

    // 更新连接状态指示
    _setConnectionStatus(status) {
        const el = document.getElementById('terminalPromptDisplay');
        if (!el) return;
        el.title = status === 'connected' ? '已连接' :
                   status === 'disconnected' ? '连接断开，正在重连...' : '连接失败';
        el.style.color = status === 'connected' ? '' :
                         status === 'disconnected' ? 'var(--warning)' : 'var(--danger)';
    },

    // 设置输入框事件
    setupInputEvents() {
        const input = document.getElementById('terminalInput');
        if (!input) return;

        input.addEventListener('keydown', (e) => {
            const terminal = this.getCurrentTerminal();
            if (!terminal) return;

            if (e.key === 'Enter') {
                e.preventDefault();
                terminal.clearTabHints();
                this.handleCommand();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                terminal.clearTabHints();
                this.navigateHistory('up');
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                terminal.clearTabHints();
                this.navigateHistory('down');
            } else if (e.key === 'Tab') {
                e.preventDefault();
                this._requestTabComplete(input.value, terminal);
            } else if (e.key === 'c' && e.ctrlKey) {
                e.preventDefault();
                this._sendInterrupt(terminal);
            } else if (e.key !== 'Tab') {
                // 非 Tab 键清除 Tab 候选
                if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt') {
                    terminal.tabCandidates = [];
                    terminal.tabIndex = -1;
                }
            }
        });

        input.focus();

        const terminalMain = document.getElementById('terminalMain');
        if (terminalMain) {
            terminalMain.addEventListener('click', (e) => {
                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) return;
                input.focus();
            });
        }
    },

    // 请求 Tab 补全
    _requestTabComplete(partial, terminal) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('tab_complete', {
                partial: partial,
                terminal_id: terminal.id
            });
        }
    },

    // 发送 Ctrl+C 中断
    _sendInterrupt(terminal) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('interrupt', { terminal_id: terminal.id });
        }
        terminal.isRunning = false;
        this.updateInputState();
    },

    // 创建新终端
    createNewTerminal() {
        const id = this.nextId++;
        const terminal = new Terminal(id, `终端 ${id}`);

        terminal.outputHtml = `
            <div class="terminal-line welcome-message">
                <span class="terminal-prompt">></span>
                <span class="terminal-text">欢迎使用 CoolTerminal v2.0 - 实时流式终端</span>
            </div>
            <div class="terminal-line">
                <span class="terminal-prompt">></span>
                <span class="terminal-text">支持实时输出 · Tab 补全 · Ctrl+C 中断 · ANSI 颜色</span>
            </div>
        `;

        this.terminals.push(terminal);
        this.switchTerminal(id);
        this.updateTerminalTabs();

        // 获取初始 cwd
        if (this.socket && this.socket.connected) {
            this.socket.emit('get_cwd', { terminal_id: id });
        }

        return terminal;
    },

    // 切换终端
    switchTerminal(id) {
        this.currentTerminalId = id;
        this.updateCurrentTerminalOutput();
        this.updateHistoryPanel();
        this.updateTerminalTabs();
        this.updatePrompt();

        const input = document.getElementById('terminalInput');
        if (input) input.focus();
    },

    // 关闭终端
    closeTerminal(id) {
        if (this.terminals.length <= 1) {
            alert('至少需要保留一个终端');
            return;
        }

        const index = this.terminals.findIndex(t => t.id === id);
        if (index === -1) return;

        this.terminals.splice(index, 1);

        if (this.currentTerminalId === id) {
            const next = this.terminals[Math.min(index, this.terminals.length - 1)];
            this.switchTerminal(next.id);
        }

        this.updateTerminalTabs();
    },

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
        if (terminal.isRunning) return;

        input.value = '';
        terminal.historyIndex = -1;
        this.addToGlobalHistory(command);
        terminal.addCommandLine(command);
        this.updateCurrentTerminalOutput();

        // 内置命令
        if (command === 'clear' || command === 'cls') {
            terminal.clear();
            this.updateCurrentTerminalOutput();
            return;
        }

        terminal.isRunning = true;
        this.updateInputState();

        if (this.socket && this.socket.connected) {
            // WebSocket 模式（流式）
            this.socket.emit('execute', { command, terminal_id: terminal.id });

            // 超时兜底：60s 没收到 command_done 则强制解锁
            terminal._cmdTimeout = setTimeout(() => {
                if (terminal.isRunning) {
                    terminal.forceUnlock('命令超时（>60s），已强制终止等待\r\n');
                    this.updateCurrentTerminalOutput();
                    this.updateInputState();
                }
            }, 60000);
        } else {
            // REST 降级模式
            await this._executeRest(command, terminal);
        }
    },

    // REST 降级执行
    async _executeRest(command, terminal) {
        try {
            const response = await fetch('/api/terminal/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command, session_id: `rest-${terminal.id}` })
            });
            const data = await response.json();
            const output = data.output || (data.success ? '命令执行成功（无输出）' : data.error);
            const type = data.success ? 'success' : 'error';
            terminal.appendOutput(output + '\n', type);
            if (data.cwd) terminal.cwd = data.cwd;
        } catch (err) {
            terminal.appendOutput(`连接错误: ${err.message}\n`, 'error');
        } finally {
            terminal.finalizeOutput();
            this.updateCurrentTerminalOutput();
            this.updatePrompt();
        }
    },

    // 历史导航
    navigateHistory(direction) {
        const terminal = this.getCurrentTerminal();
        if (!terminal) return;
        const input = document.getElementById('terminalInput');
        if (input) terminal.navigateHistory(direction, input);
    },

    // 更新输入框状态（运行中禁用）
    updateInputState() {
        const terminal = this.getCurrentTerminal();
        const input = document.getElementById('terminalInput');
        if (!input || !terminal) return;
        input.disabled = terminal.isRunning;
        input.placeholder = terminal.isRunning ? '命令执行中... (Ctrl+C 中断)' : '输入命令...';
        if (!terminal.isRunning) input.focus();
    },

    // 更新提示符显示
    updatePrompt() {
        const terminal = this.getCurrentTerminal();
        const promptEl = document.getElementById('terminalPromptDisplay');
        if (!promptEl || !terminal) return;
        promptEl.textContent = terminal._getCwdPrompt();
    },

    // === 全局历史管理 ===
    addToGlobalHistory(command) {
        const idx = this.globalHistoryCommands.indexOf(command);
        if (idx !== -1) this.globalHistoryCommands.splice(idx, 1);
        this.globalHistoryCommands.unshift(command);
        if (this.globalHistoryCommands.length > 50) this.globalHistoryCommands.length = 50;

        this.globalCommandHistory.push(command);
        if (this.globalCommandHistory.length > 100) this.globalCommandHistory.shift();

        this.saveGlobalHistory();
        this.updateHistoryPanel();
    },

    getGlobalHistoryCommands() { return this.globalHistoryCommands; },
    getGlobalCommandHistory() { return this.globalCommandHistory; },

    saveGlobalHistory() {
        try {
            localStorage.setItem('coolterminal_global_history', JSON.stringify(this.globalHistoryCommands));
            localStorage.setItem('coolterminal_global_command_history', JSON.stringify(this.globalCommandHistory));
        } catch (e) {}
    },

    loadGlobalHistory() {
        try {
            const h = localStorage.getItem('coolterminal_global_history');
            if (h) this.globalHistoryCommands = JSON.parse(h);
            const ch = localStorage.getItem('coolterminal_global_command_history');
            if (ch) this.globalCommandHistory = JSON.parse(ch);
        } catch (e) {
            this.globalHistoryCommands = [];
            this.globalCommandHistory = [];
        }
    },

    clearGlobalHistory() {
        if (!confirm('确定要清空所有命令历史吗？')) return;
        this.globalHistoryCommands = [];
        this.globalCommandHistory = [];
        this.terminals.forEach(t => t.historyIndex = -1);
        this.saveGlobalHistory();
        this.updateHistoryPanel();
    },

    // === UI 更新 ===
    updateCurrentTerminalOutput() {
        const terminal = this.getCurrentTerminal();
        if (!terminal) return;
        const output = document.getElementById('terminalOutput');
        if (output) {
            output.innerHTML = terminal.outputHtml;
            this.scrollToBottom();
        }
    },

    updateHistoryPanel() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        if (this.globalHistoryCommands.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <i data-feather="terminal" style="width:32px;height:32px;opacity:0.3;"></i>
                    <p>暂无命令历史</p>
                </div>
            `;
            if (typeof feather !== 'undefined') feather.replace();
            return;
        }

        historyList.innerHTML = this.globalHistoryCommands.map(cmd => {
            const escaped = this.escapeHtml(cmd).replace(/'/g, "\\'");
            return `
                <div class="history-item" onclick="TerminalManager.executeFromHistory('${escaped}')">
                    <div class="history-item-content">
                        <div class="history-command">${this.escapeHtml(cmd)}</div>
                        <div class="history-time">最近使用</div>
                    </div>
                </div>
            `;
        }).join('');

        if (typeof feather !== 'undefined') feather.replace();
    },

    updateTerminalTabs() {
        const tabsList = document.getElementById('terminalTabsList');
        if (!tabsList) return;

        tabsList.innerHTML = this.terminals.map(t => {
            const isActive = t.id === this.currentTerminalId;
            return `
                <div class="terminal-tab-item ${isActive ? 'active' : ''}"
                     onclick="TerminalManager.switchTerminal(${t.id})">
                    <i data-feather="terminal" class="terminal-tab-icon"></i>
                    <span class="terminal-tab-name">${t.name}</span>
                    <button class="terminal-tab-close"
                            onclick="event.stopPropagation(); TerminalManager.closeTerminal(${t.id})"
                            title="关闭终端">
                        <i data-feather="x"></i>
                    </button>
                </div>
            `;
        }).join('');

        if (typeof feather !== 'undefined') feather.replace();
    },

    executeFromHistory(command) {
        const input = document.getElementById('terminalInput');
        if (input) { input.value = command; input.focus(); }
    },

    toggleHistory() {
        const panel = document.getElementById('historyPanel');
        if (!panel) return;
        panel.classList.toggle('hidden');
        const btn = document.getElementById('historyToggleBtn');
        if (btn) btn.style.opacity = panel.classList.contains('hidden') ? '0.6' : '1';
    },

    clearHistory() { this.clearGlobalHistory(); },

    clearScreen() {
        const terminal = this.getCurrentTerminal();
        if (!terminal) return;
        terminal.clear();
        this.updateCurrentTerminalOutput();
    },

    scrollToBottom() {
        const output = document.getElementById('terminalOutput');
        if (output) output.scrollTop = output.scrollHeight;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
