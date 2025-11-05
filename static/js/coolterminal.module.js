/**
 * CoolTerminal Module
 * 可集成到任意项目的终端模块
 * @version 1.0.0
 * @license MIT
 */

(function(global) {
    'use strict';

    /**
     * CoolTerminal 类 - 核心终端实例
     */
    class CoolTerminalInstance {
        constructor(options = {}) {
            this.options = {
                container: options.container || document.body,
                apiEndpoint: options.apiEndpoint || '/api/terminal/execute',
                theme: options.theme || 'dark',
                typingSpeed: options.typingSpeed || 20,
                enableHistory: options.enableHistory !== false,
                maxHistorySize: options.maxHistorySize || 100,
                autoFocus: options.autoFocus !== false,
                showWelcome: options.showWelcome !== false,
                welcomeMessage: options.welcomeMessage || '欢迎使用 CoolTerminal',
                prompt: options.prompt || '>',
                ...options
            };

            this.id = `ct-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            this.isTyping = false;
            this.historyIndex = -1;
            this.commandHistory = [];
            this.outputHtml = '';
            this.eventHandlers = {};

            this.init();
        }

        /**
         * 初始化终端
         */
        init() {
            this.createDOM();
            this.attachEventListeners();

            if (this.options.showWelcome) {
                this.writeOutput(this.options.welcomeMessage, 'info');
            }

            if (this.options.autoFocus) {
                this.focus();
            }

            this.loadHistory();
            this.emit('ready', { instance: this });
        }

        /**
         * 创建 DOM 结构
         */
        createDOM() {
            const container = typeof this.options.container === 'string'
                ? document.querySelector(this.options.container)
                : this.options.container;

            if (!container) {
                throw new Error('Container element not found');
            }

            // 创建终端容器
            this.wrapper = document.createElement('div');
            this.wrapper.className = `coolterminal-wrapper theme-${this.options.theme}`;
            this.wrapper.id = this.id;

            // 注入样式
            if (!document.getElementById('coolterminal-styles')) {
                this.injectStyles();
            }

            // 创建终端输出区域
            this.outputElement = document.createElement('div');
            this.outputElement.className = 'coolterminal-output';

            // 创建输入区域
            this.inputWrapper = document.createElement('div');
            this.inputWrapper.className = 'coolterminal-input-wrapper';

            this.promptElement = document.createElement('span');
            this.promptElement.className = 'coolterminal-prompt';
            this.promptElement.textContent = this.options.prompt;

            this.inputElement = document.createElement('input');
            this.inputElement.type = 'text';
            this.inputElement.className = 'coolterminal-input';
            this.inputElement.placeholder = '输入命令...';

            this.inputWrapper.appendChild(this.promptElement);
            this.inputWrapper.appendChild(this.inputElement);

            this.wrapper.appendChild(this.outputElement);
            this.wrapper.appendChild(this.inputWrapper);

            container.appendChild(this.wrapper);
        }

        /**
         * 注入样式
         */
        injectStyles() {
            const styles = `
                .coolterminal-wrapper {
                    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                    background: #1e1e1e;
                    color: #d4d4d4;
                    border-radius: 8px;
                    padding: 16px;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .coolterminal-wrapper.theme-light {
                    background: #ffffff;
                    color: #333333;
                }

                .coolterminal-output {
                    flex: 1;
                    overflow-y: auto;
                    margin-bottom: 12px;
                    font-size: 14px;
                    line-height: 1.6;
                    user-select: text;
                    cursor: text;
                }

                .coolterminal-line {
                    margin: 4px 0;
                }

                .coolterminal-prompt {
                    color: #4EC9B0;
                    margin-right: 8px;
                    font-weight: bold;
                    user-select: none;
                }

                .coolterminal-command {
                    color: #00ff41;
                    user-select: text;
                }

                .coolterminal-result {
                    display: inline-block;
                    white-space: pre-wrap;
                    word-break: break-all;
                    user-select: text;
                    color: rgba(0, 255, 65, 0.7);
                }

                .coolterminal-result.success {
                    color: rgba(0, 255, 65, 0.7);
                }

                .coolterminal-result.error {
                    color: #F48771;
                }

                .coolterminal-result.warning {
                    color: #DCDCAA;
                }

                .coolterminal-result.info {
                    color: #4FC1FF;
                }

                .coolterminal-input-wrapper {
                    display: flex;
                    align-items: center;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    padding-top: 12px;
                }

                .coolterminal-input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: inherit;
                    font-family: inherit;
                    font-size: 14px;
                    outline: none;
                }

                .coolterminal-input::placeholder {
                    color: rgba(255, 255, 255, 0.3);
                }

                .coolterminal-output::-webkit-scrollbar {
                    width: 8px;
                }

                .coolterminal-output::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 4px;
                }

                .coolterminal-output::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                }

                .coolterminal-output::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.3);
                }

                /* 文本选中样式 */
                .coolterminal-output ::selection {
                    background: rgba(78, 201, 176, 0.4);
                    color: #ffffff;
                }

                .coolterminal-output ::-moz-selection {
                    background: rgba(78, 201, 176, 0.4);
                    color: #ffffff;
                }
            `;

            const styleElement = document.createElement('style');
            styleElement.id = 'coolterminal-styles';
            styleElement.textContent = styles;
            document.head.appendChild(styleElement);
        }

        /**
         * 绑定事件监听
         */
        attachEventListeners() {
            // 回车执行命令
            this.inputElement.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const command = this.inputElement.value.trim();
                    if (command) {
                        this.execute(command);
                        this.inputElement.value = '';
                    }
                }
                // 上下键浏览历史
                else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.navigateHistory('up');
                }
                else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.navigateHistory('down');
                }
            });
        }

        /**
         * 执行命令
         * @param {string} command - 要执行的命令
         * @returns {Promise<Object>} 执行结果
         */
        async execute(command) {
            if (this.isTyping || !command.trim()) {
                return { success: false, error: 'Invalid command or terminal is busy' };
            }

            // 添加命令到输出
            this.addCommandLine(command);

            // 添加到历史
            if (this.options.enableHistory) {
                this.addToHistory(command);
            }

            // 触发命令事件
            this.emit('command', { command });

            // 执行命令
            try {
                this.isTyping = true;

                const response = await fetch(this.options.apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ command })
                });

                const data = await response.json();

                if (data.success) {
                    const output = data.output || '命令执行成功（无输出）';
                    const className = data.exit_code === 0 ? 'success' : 'warning';
                    await this.typeOutput(output, className);
                    this.emit('output', { command, output, exitCode: data.exit_code });
                    return { success: true, output, exitCode: data.exit_code };
                } else {
                    const error = data.output || data.error;
                    await this.typeOutput(error, 'error');
                    this.emit('error', { command, error });
                    return { success: false, error };
                }
            } catch (error) {
                const errorMsg = `连接错误: ${error.message}`;
                await this.typeOutput(errorMsg, 'error');
                this.emit('error', { command, error: errorMsg });
                return { success: false, error: errorMsg };
            } finally {
                this.isTyping = false;
                this.historyIndex = -1;
            }
        }

        /**
         * 添加命令行到输出
         */
        addCommandLine(command) {
            const escapedCommand = this.escapeHtml(command);
            this.outputHtml += `
                <div class="coolterminal-line">
                    <span class="coolterminal-prompt">${this.options.prompt}</span>
                    <span class="coolterminal-command">${escapedCommand}</span>
                </div>
            `;
            this.updateOutput();
        }

        /**
         * 打字机效果输出
         */
        async typeOutput(text, className = '') {
            const lineId = `line-${Date.now()}-${Math.random()}`;
            this.outputHtml += `
                <div class="coolterminal-line">
                    <span class="coolterminal-result ${className}" id="${lineId}"></span>
                </div>
            `;

            this.updateOutput();

            const resultSpan = document.getElementById(lineId);
            if (resultSpan && this.options.typingSpeed > 0) {
                for (let i = 0; i < text.length; i++) {
                    resultSpan.textContent += text[i];
                    this.scrollToBottom();
                    await this.sleep(this.options.typingSpeed);
                }
            } else if (resultSpan) {
                resultSpan.textContent = text;
                this.scrollToBottom();
            }
        }

        /**
         * 直接写入输出（无打字机效果）
         */
        writeOutput(text, className = '') {
            const escapedText = this.escapeHtml(text);
            this.outputHtml += `
                <div class="coolterminal-line">
                    <span class="coolterminal-result ${className}">${escapedText}</span>
                </div>
            `;
            this.updateOutput();
            this.scrollToBottom();
        }

        /**
         * 更新输出区域
         */
        updateOutput() {
            if (this.outputElement) {
                this.outputElement.innerHTML = this.outputHtml;
            }
        }

        /**
         * 滚动到底部
         */
        scrollToBottom() {
            if (this.outputElement) {
                this.outputElement.scrollTop = this.outputElement.scrollHeight;
            }
        }

        /**
         * 清空终端
         */
        clear() {
            this.outputHtml = '';
            this.updateOutput();
            this.emit('clear');
        }

        /**
         * 聚焦输入框
         */
        focus() {
            if (this.inputElement) {
                this.inputElement.focus();
            }
        }

        /**
         * 添加到历史记录
         */
        addToHistory(command) {
            // 移除重复
            const existingIndex = this.commandHistory.indexOf(command);
            if (existingIndex !== -1) {
                this.commandHistory.splice(existingIndex, 1);
            }

            this.commandHistory.unshift(command);

            // 限制历史大小
            if (this.commandHistory.length > this.options.maxHistorySize) {
                this.commandHistory = this.commandHistory.slice(0, this.options.maxHistorySize);
            }

            this.saveHistory();
        }

        /**
         * 浏览历史记录
         */
        navigateHistory(direction) {
            if (this.commandHistory.length === 0) return;

            if (direction === 'up') {
                this.historyIndex = Math.min(
                    this.historyIndex + 1,
                    this.commandHistory.length - 1
                );
            } else if (direction === 'down') {
                this.historyIndex = Math.max(this.historyIndex - 1, -1);
            }

            if (this.historyIndex >= 0) {
                this.inputElement.value = this.commandHistory[this.historyIndex];
            } else {
                this.inputElement.value = '';
            }
        }

        /**
         * 保存历史记录
         */
        saveHistory() {
            if (this.options.enableHistory && typeof localStorage !== 'undefined') {
                try {
                    localStorage.setItem(
                        `coolterminal_history_${this.id}`,
                        JSON.stringify(this.commandHistory)
                    );
                } catch (e) {
                    console.warn('Failed to save history:', e);
                }
            }
        }

        /**
         * 加载历史记录
         */
        loadHistory() {
            if (this.options.enableHistory && typeof localStorage !== 'undefined') {
                try {
                    const saved = localStorage.getItem(`coolterminal_history_${this.id}`);
                    if (saved) {
                        this.commandHistory = JSON.parse(saved);
                    }
                } catch (e) {
                    console.warn('Failed to load history:', e);
                }
            }
        }

        /**
         * 事件监听
         */
        on(event, handler) {
            if (!this.eventHandlers[event]) {
                this.eventHandlers[event] = [];
            }
            this.eventHandlers[event].push(handler);
            return this;
        }

        /**
         * 移除事件监听
         */
        off(event, handler) {
            if (!this.eventHandlers[event]) return this;

            if (handler) {
                this.eventHandlers[event] = this.eventHandlers[event]
                    .filter(h => h !== handler);
            } else {
                delete this.eventHandlers[event];
            }
            return this;
        }

        /**
         * 触发事件
         */
        emit(event, data) {
            if (this.eventHandlers[event]) {
                this.eventHandlers[event].forEach(handler => {
                    try {
                        handler(data);
                    } catch (e) {
                        console.error(`Error in event handler for ${event}:`, e);
                    }
                });
            }
        }

        /**
         * 销毁终端实例
         */
        destroy() {
            this.emit('destroy');

            if (this.wrapper && this.wrapper.parentNode) {
                this.wrapper.parentNode.removeChild(this.wrapper);
            }

            this.eventHandlers = {};
            this.commandHistory = [];
            this.outputHtml = '';
        }

        /**
         * HTML 转义
         */
        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        /**
         * 延迟函数
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    }

    /**
     * CoolTerminal 静态工厂类
     */
    class CoolTerminal {
        /**
         * 创建终端实例
         * @param {Object} options - 配置选项
         * @returns {CoolTerminalInstance}
         */
        static create(options) {
            return new CoolTerminalInstance(options);
        }

        /**
         * 版本号
         */
        static get version() {
            return '1.0.0';
        }
    }

    // 导出到全局
    if (typeof module !== 'undefined' && module.exports) {
        // Node.js / CommonJS
        module.exports = CoolTerminal;
    } else if (typeof define === 'function' && define.amd) {
        // AMD
        define([], function() {
            return CoolTerminal;
        });
    } else {
        // Browser globals
        global.CoolTerminal = CoolTerminal;
    }

})(typeof window !== 'undefined' ? window : this);
