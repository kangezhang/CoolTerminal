/**
 * CoolTerminal React 集成示例
 *
 * 安装依赖:
 * npm install react react-dom
 *
 * 使用方法:
 * import Terminal from './react-example.jsx';
 * <Terminal />
 */

import React, { useEffect, useRef, useState } from 'react';

// 引入 CoolTerminal 模块（根据实际路径调整）
// import CoolTerminal from '../static/js/coolterminal.module.js';
// 或者在浏览器环境使用全局变量
const CoolTerminal = window.CoolTerminal;

/**
 * Terminal 组件
 */
function Terminal({
    apiEndpoint = 'http://localhost:5000/api/terminal/execute',
    theme = 'dark',
    height = '600px',
    onCommand,
    onOutput,
    onError
}) {
    const containerRef = useRef(null);
    const terminalRef = useRef(null);
    const [commandCount, setCommandCount] = useState(0);
    const [lastCommand, setLastCommand] = useState('');

    useEffect(() => {
        // 创建终端实例
        if (containerRef.current && !terminalRef.current) {
            terminalRef.current = CoolTerminal.create({
                container: containerRef.current,
                theme: theme,
                apiEndpoint: apiEndpoint,
                welcomeMessage: 'React 集成终端\n输入命令开始...'
            });

            // 监听事件
            terminalRef.current.on('command', (data) => {
                setLastCommand(data.command);
                setCommandCount(prev => prev + 1);
                onCommand?.(data);
            });

            terminalRef.current.on('output', (data) => {
                onOutput?.(data);
            });

            terminalRef.current.on('error', (data) => {
                onError?.(data);
            });
        }

        // 清理函数
        return () => {
            if (terminalRef.current) {
                terminalRef.current.destroy();
                terminalRef.current = null;
            }
        };
    }, [apiEndpoint, theme, onCommand, onOutput, onError]);

    // 暴露给父组件的方法
    useEffect(() => {
        if (terminalRef.current) {
            // 可以通过 ref 暴露方法给父组件
            window.terminalInstance = terminalRef.current;
        }
    }, []);

    return (
        <div style={{ width: '100%' }}>
            <div style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
                执行命令数: {commandCount} | 最后执行: {lastCommand || '无'}
            </div>
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: height,
                    borderRadius: '8px',
                    overflow: 'hidden'
                }}
            />
        </div>
    );
}

/**
 * 示例应用
 */
function App() {
    const [logs, setLogs] = useState([]);

    const handleCommand = (data) => {
        addLog(`执行命令: ${data.command}`, 'info');
    };

    const handleOutput = (data) => {
        addLog(`输出 (exit code: ${data.exitCode}): ${data.output.substring(0, 50)}...`, 'success');
    };

    const handleError = (data) => {
        addLog(`错误: ${data.error}`, 'error');
    };

    const addLog = (message, type) => {
        setLogs(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
    };

    const clearLogs = () => {
        setLogs([]);
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1>CoolTerminal React 集成示例</h1>

            <div style={{ marginBottom: '20px' }}>
                <button
                    onClick={() => window.terminalInstance?.execute('ls')}
                    style={{ marginRight: '10px', padding: '8px 16px' }}
                >
                    执行 ls
                </button>
                <button
                    onClick={() => window.terminalInstance?.execute('pwd')}
                    style={{ marginRight: '10px', padding: '8px 16px' }}
                >
                    执行 pwd
                </button>
                <button
                    onClick={() => window.terminalInstance?.clear()}
                    style={{ marginRight: '10px', padding: '8px 16px' }}
                >
                    清空终端
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                {/* 终端区域 */}
                <div>
                    <Terminal
                        apiEndpoint="http://localhost:5000/api/terminal/execute"
                        theme="dark"
                        height="500px"
                        onCommand={handleCommand}
                        onOutput={handleOutput}
                        onError={handleError}
                    />
                </div>

                {/* 日志区域 */}
                <div>
                    <div style={{
                        background: '#f5f5f5',
                        padding: '15px',
                        borderRadius: '8px',
                        height: '500px',
                        overflowY: 'auto'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '10px'
                        }}>
                            <h3 style={{ margin: 0 }}>事件日志</h3>
                            <button
                                onClick={clearLogs}
                                style={{ padding: '4px 12px', fontSize: '12px' }}
                            >
                                清空
                            </button>
                        </div>
                        {logs.length === 0 ? (
                            <p style={{ color: '#999', fontSize: '14px' }}>暂无日志</p>
                        ) : (
                            logs.map((log, index) => (
                                <div
                                    key={index}
                                    style={{
                                        padding: '8px',
                                        marginBottom: '5px',
                                        background: 'white',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        borderLeft: `3px solid ${
                                            log.type === 'error' ? '#f44336' :
                                            log.type === 'success' ? '#4caf50' :
                                            '#2196f3'
                                        }`
                                    }}
                                >
                                    <div style={{ color: '#999', fontSize: '11px' }}>
                                        {log.time}
                                    </div>
                                    <div>{log.message}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;

// 如果需要直接在浏览器中使用
if (typeof window !== 'undefined') {
    window.TerminalComponent = Terminal;
    window.TerminalApp = App;
}
