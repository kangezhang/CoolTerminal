<template>
    <div class="terminal-app">
        <h1>CoolTerminal Vue 集成示例</h1>

        <!-- 控制按钮 -->
        <div class="controls">
            <button @click="executeCommand('ls -la')" class="btn">📁 执行 ls</button>
            <button @click="executeCommand('pwd')" class="btn">📍 执行 pwd</button>
            <button @click="executeCommand('date')" class="btn">📅 执行 date</button>
            <button @click="clearTerminal" class="btn">🗑️ 清空</button>
            <button @click="showStats" class="btn">📊 统计</button>
        </div>

        <div class="layout">
            <!-- 终端区域 -->
            <div class="terminal-section">
                <div ref="terminalContainer" class="terminal-container"></div>
            </div>

            <!-- 状态面板 -->
            <div class="status-panel">
                <h3>📈 状态信息</h3>
                <div class="stat-item">
                    <span class="stat-label">终端状态:</span>
                    <span class="stat-value" :class="terminalReady ? 'success' : 'warning'">
                        {{ terminalReady ? '✓ 就绪' : '⏳ 初始化中' }}
                    </span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">执行次数:</span>
                    <span class="stat-value">{{ commandCount }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">成功次数:</span>
                    <span class="stat-value success">{{ successCount }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">失败次数:</span>
                    <span class="stat-value error">{{ errorCount }}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">最后命令:</span>
                    <span class="stat-value">{{ lastCommand || '无' }}</span>
                </div>

                <h3 style="margin-top: 20px;">📝 最近输出</h3>
                <div class="recent-outputs">
                    <div
                        v-for="(output, index) in recentOutputs"
                        :key="index"
                        class="output-item"
                    >
                        <div class="output-time">{{ output.time }}</div>
                        <div class="output-command">{{ output.command }}</div>
                        <div class="output-result" :class="output.type">
                            {{ output.result }}
                        </div>
                    </div>
                    <div v-if="recentOutputs.length === 0" class="no-data">
                        暂无输出
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
// 引入 CoolTerminal 模块
// import CoolTerminal from '../static/js/coolterminal.module.js';
// 或者使用全局变量
const CoolTerminal = window.CoolTerminal;

export default {
    name: 'TerminalApp',

    data() {
        return {
            terminal: null,
            terminalReady: false,
            commandCount: 0,
            successCount: 0,
            errorCount: 0,
            lastCommand: '',
            recentOutputs: []
        };
    },

    mounted() {
        this.initTerminal();
    },

    beforeUnmount() {
        if (this.terminal) {
            this.terminal.destroy();
        }
    },

    methods: {
        initTerminal() {
            // 创建终端实例
            this.terminal = CoolTerminal.create({
                container: this.$refs.terminalContainer,
                theme: 'dark',
                apiEndpoint: 'http://localhost:5000/api/terminal/execute',
                welcomeMessage: 'Vue 集成终端\n输入命令开始体验...',
                typingSpeed: 15
            });

            // 监听事件
            this.terminal.on('ready', () => {
                this.terminalReady = true;
                console.log('✅ 终端已就绪');
            });

            this.terminal.on('command', (data) => {
                this.lastCommand = data.command;
                this.commandCount++;
            });

            this.terminal.on('output', (data) => {
                this.successCount++;
                this.addRecentOutput(
                    data.command,
                    data.output.substring(0, 100),
                    'success'
                );
            });

            this.terminal.on('error', (data) => {
                this.errorCount++;
                this.addRecentOutput(
                    data.command,
                    data.error,
                    'error'
                );
            });
        },

        executeCommand(command) {
            if (this.terminal) {
                this.terminal.execute(command);
            }
        },

        clearTerminal() {
            if (this.terminal) {
                this.terminal.clear();
            }
        },

        showStats() {
            if (this.terminal) {
                this.terminal.writeOutput('=== 统计信息 ===', 'info');
                this.terminal.writeOutput(`总命令数: ${this.commandCount}`, 'success');
                this.terminal.writeOutput(`成功: ${this.successCount}`, 'success');
                this.terminal.writeOutput(`失败: ${this.errorCount}`, 'error');
            }
        },

        addRecentOutput(command, result, type) {
            this.recentOutputs.unshift({
                time: new Date().toLocaleTimeString(),
                command: command,
                result: result,
                type: type
            });

            // 只保留最近 10 条
            if (this.recentOutputs.length > 10) {
                this.recentOutputs = this.recentOutputs.slice(0, 10);
            }
        }
    }
};
</script>

<style scoped>
.terminal-app {
    padding: 20px;
    max-width: 1400px;
    margin: 0 auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

h1 {
    margin-bottom: 20px;
    color: #333;
}

.controls {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    background: #667eea;
    color: white;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.3s;
}

.btn:hover {
    background: #5568d3;
    transform: translateY(-2px);
}

.layout {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 20px;
}

.terminal-section {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.terminal-container {
    height: 600px;
}

.status-panel {
    background: white;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.status-panel h3 {
    margin: 0 0 15px 0;
    font-size: 16px;
    color: #333;
}

.stat-item {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #f0f0f0;
    font-size: 14px;
}

.stat-label {
    color: #666;
}

.stat-value {
    font-weight: 600;
    color: #333;
}

.stat-value.success {
    color: #4caf50;
}

.stat-value.error {
    color: #f44336;
}

.stat-value.warning {
    color: #ff9800;
}

.recent-outputs {
    max-height: 300px;
    overflow-y: auto;
}

.output-item {
    padding: 10px;
    margin-bottom: 10px;
    background: #f9f9f9;
    border-radius: 8px;
    font-size: 12px;
}

.output-time {
    color: #999;
    font-size: 11px;
    margin-bottom: 4px;
}

.output-command {
    color: #667eea;
    font-weight: 600;
    margin-bottom: 4px;
}

.output-result {
    color: #666;
    word-break: break-all;
}

.output-result.success {
    color: #4caf50;
}

.output-result.error {
    color: #f44336;
}

.no-data {
    color: #999;
    text-align: center;
    padding: 20px;
    font-size: 14px;
}

@media (max-width: 768px) {
    .layout {
        grid-template-columns: 1fr;
    }
}
</style>
