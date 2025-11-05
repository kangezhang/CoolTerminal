/**
 * CoolTerminal Module TypeScript Definitions
 * @version 1.0.0
 */

declare module 'coolterminal' {
    /**
     * 终端配置选项
     */
    export interface CoolTerminalOptions {
        /**
         * 终端挂载的容器元素（DOM元素或CSS选择器）
         */
        container?: HTMLElement | string;

        /**
         * API 端点地址
         * @default '/api/terminal/execute'
         */
        apiEndpoint?: string;

        /**
         * 终端主题
         * @default 'dark'
         */
        theme?: 'dark' | 'light';

        /**
         * 打字机效果速度（毫秒）
         * @default 20
         */
        typingSpeed?: number;

        /**
         * 是否启用命令历史记录
         * @default true
         */
        enableHistory?: boolean;

        /**
         * 最大历史记录条数
         * @default 100
         */
        maxHistorySize?: number;

        /**
         * 是否自动聚焦输入框
         * @default true
         */
        autoFocus?: boolean;

        /**
         * 是否显示欢迎消息
         * @default true
         */
        showWelcome?: boolean;

        /**
         * 自定义欢迎消息
         * @default '欢迎使用 CoolTerminal'
         */
        welcomeMessage?: string;

        /**
         * 终端提示符
         * @default '$'
         */
        prompt?: string;
    }

    /**
     * 命令执行结果
     */
    export interface ExecutionResult {
        /**
         * 是否执行成功
         */
        success: boolean;

        /**
         * 命令输出
         */
        output?: string;

        /**
         * 错误信息
         */
        error?: string;

        /**
         * 退出代码
         */
        exitCode?: number;
    }

    /**
     * 事件数据类型
     */
    export interface EventData {
        ready?: { instance: CoolTerminalInstance };
        command?: { command: string };
        output?: { command: string; output: string; exitCode: number };
        error?: { command: string; error: string };
        clear?: {};
        destroy?: {};
    }

    /**
     * 事件处理器类型
     */
    export type EventHandler<T extends keyof EventData> = (data: EventData[T]) => void;

    /**
     * CoolTerminal 实例类
     */
    export class CoolTerminalInstance {
        /**
         * 终端唯一标识
         */
        readonly id: string;

        /**
         * 终端配置选项
         */
        readonly options: CoolTerminalOptions;

        /**
         * 是否正在输出中
         */
        readonly isTyping: boolean;

        /**
         * 命令历史记录
         */
        readonly commandHistory: string[];

        /**
         * 构造函数
         * @param options 配置选项
         */
        constructor(options?: CoolTerminalOptions);

        /**
         * 执行命令
         * @param command 要执行的命令
         * @returns Promise 返回执行结果
         */
        execute(command: string): Promise<ExecutionResult>;

        /**
         * 直接写入输出（无打字机效果）
         * @param text 要输出的文本
         * @param className 样式类名 ('success' | 'error' | 'warning' | 'info')
         */
        writeOutput(text: string, className?: string): void;

        /**
         * 清空终端输出
         */
        clear(): void;

        /**
         * 聚焦输入框
         */
        focus(): void;

        /**
         * 监听事件
         * @param event 事件名称
         * @param handler 事件处理器
         * @returns 返回实例本身，支持链式调用
         */
        on<T extends keyof EventData>(event: T, handler: EventHandler<T>): this;

        /**
         * 移除事件监听
         * @param event 事件名称
         * @param handler 可选的事件处理器，不传则移除该事件的所有监听器
         * @returns 返回实例本身，支持链式调用
         */
        off<T extends keyof EventData>(event: T, handler?: EventHandler<T>): this;

        /**
         * 销毁终端实例
         */
        destroy(): void;
    }

    /**
     * CoolTerminal 静态类
     */
    export class CoolTerminal {
        /**
         * 创建终端实例
         * @param options 配置选项
         * @returns 终端实例
         */
        static create(options?: CoolTerminalOptions): CoolTerminalInstance;

        /**
         * 版本号
         */
        static readonly version: string;
    }

    export default CoolTerminal;
}

/**
 * 全局声明（用于浏览器环境）
 */
declare global {
    interface Window {
        CoolTerminal: typeof import('coolterminal').CoolTerminal;
    }
}
