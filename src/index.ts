/**
 * WebSocket.readyState
 * 0 (WebSocket.CONNECTING) 正在链接中
 * 1 (WebSocket.OPEN) 已经链接并且可以通讯
 * 2 (WebSocket.CLOSING) 连接正在关闭
 * 3 (WebSocket.CLOSED) 连接已关闭或者没有链接成功
 */


import {
    WebSocketConnectOptions,
    WebSocketEventTypes,
    SendData,
    ListenerStorage,
    SocketListener,
    SocketListenerStorage,
    SubscribeListener,
    SubscribeListenerStorage,
    DefineEventOptions
} from '../types/index';
import { addListener, removeListener, isFunction } from './utils';
import Subscribe from './subscribe';


class WebSocketConnect<T extends object = { [key: string]: object }> {
    // WebSocket 实例
    private socket: WebSocket | null = null;

    // 订阅事件数量统计
    private subscribeCount = 0;

    // 等待发送数据存储器
    private dataSendStorage: string[] = [];

    // 事件定义选项存储器
    private defineEventStorage: { [key in keyof T]?: DefineEventOptions } = {};

    // WebSocket 事件监听器存储器
    private socketListenerStorage: SocketListenerStorage = {};

    // 订阅事件监听器存储器
    private subscribeListenerStorage: SubscribeListenerStorage = {};

    //
    public constructor(private options: WebSocketConnectOptions<T>) {
        this.options = options;
    }


    /**
     * 绑定 WebSocket 事件监听
     * @param type
     * @param listener
     */
    public on<K extends WebSocketEventTypes>(type: K, listener: SocketListener<K>) {
        addListener(type, listener, this.socketListenerStorage as ListenerStorage);
    }


    /**
     * 绑定 WebSocket 事件监听，仅绑定一次
     * @param type
     * @param listener
     */
    public once<K extends WebSocketEventTypes>(type: K, listener: SocketListener<K>) {
        const _listener: SocketListener<K> = (evt) => {
            listener(evt);
            this.off(type, _listener);
        };
        this.on(type, _listener);
    }


    /**
     * 取消 WebSocket 事件监听
     * @param type
     * @param listener
     */
    public off<K extends WebSocketEventTypes>(type: K, listener: SocketListener<K>) {
        removeListener(type, listener, this.socketListenerStorage as ListenerStorage);
    }


    /**
     * 订阅事件
     * @param type
     * @param listener
     * @param data
     */
    public subscribe<K extends keyof T>(type: K, listener: SubscribeListener<T[K]>, data?: SendData) {
        addListener(type as string, listener, this.subscribeListenerStorage);
        this.updateCount(1);
        this.dispatchAction('subscribe', type, data);
        return new Subscribe<T, K>(this, type, listener);
    }


    /**
     * 仅订阅一次事件，订阅事件响应后立即销毁
     * @param type
     * @param listener
     * @param data
     */
    public subscribeOnce<K extends keyof T>(type: K, listener: SubscribeListener<T[K]>, data?: object) {
        const _listener: SubscribeListener<T[K]> = (res) => {
            listener(res);
            this.unsubscribe(type, _listener);
        };
        this.subscribe(type, _listener, data);
    }


    /**
     * 取消事件订阅
     * @param type
     * @param listener
     */
    public unsubscribe<K extends keyof T>(type: K, listener: SubscribeListener<T[K]>) {
        const result = removeListener(type as string, listener, this.subscribeListenerStorage);
        if (result) {
            if (result === 'EMPTY') {
                this.dispatchAction('unsubscribe', type);
            }
            this.updateCount(-1);
        }
    }


    /**
     * 触发动作
     * @param action subscribe：订阅动作，unsubscribe：取消订阅动作，update：更新订阅动作
     * @param type
     * @param data
     */
    public dispatchAction<K extends keyof T>(action: Exclude<keyof DefineEventOptions, 'recognizer'>, type: K, data?: SendData) {
        const event = this.defineEventStorage[type];
        if (event) {
            const handler = event[action];
            if (isFunction(handler)) {
                data = handler(data as object);
            }
        }
        if (data !== undefined) {
            this.send(data);
        }
    }


    /**
     * WebSocket 实例发送数据
     * 如果未连接，会自动等待连接成功后再发送
     * @param data
     */
    public send(data: SendData) {
        const { socket } = this;

        // TODO 目前仅支持发送 string，后续看需求发送 ArrayBuffer
        if (typeof data !== 'string') {
            data = JSON.stringify(data);
        }

        // 如果 WebSocket 已连接则立即发送
        // 否则将会先存储再内存中，等待第一次连接成功后再发送
        if (socket && socket.readyState === 1) {
            socket.send(data);
        } else {
            this.dataSendStorage.push(data);
        }
    }


    /**
     * 定义订阅事件
     * @param type
     * @param options
     */
    public defineEvent<K extends keyof T>(type: K, options: DefineEventOptions) {
        this.defineEventStorage[type] = options;
    }


    /**
     * 启动连接
     * 当第一次调用 subscribe 方法时会自动发起连接
     */
    public async connect() {
        // 防止重复连接，正在连接或者已经连接，退出
        const state = this.socket?.readyState;
        if (state === 0 || state === 1) {
            return;
        }

        // 创建实例
        const socket = await this.createSocket();

        // onopen 事件监听器
        const onOpen = (evt: Event) => {
            const { dataSendStorage } = this;
            this.dispatchWebSocketEvent(evt);
            if (dataSendStorage.length > 0) {
                dataSendStorage.forEach((data) => {
                    socket.send(data); // 连接成功，对等待发送的数据执行发送
                });
                this.dataSendStorage = [];
            }
        };

        // onmessage 事件监听器
        const onMessage = (evt: MessageEvent) => {
            const { transformResponse } = this.options;
            const response = isFunction(transformResponse) ? transformResponse(evt) : evt;
            this.dispatchWebSocketEvent(evt, response);
            this.recognizeEvent(response);
        };

        // onerror 事件监听器
        const onError = (evt: Event) => {
            this.dispatchWebSocketEvent(evt);
        };

        // onclose 事件监听器
        const onClose = (evt: CloseEvent) => {
            this.dispatchWebSocketEvent(evt);

            // 连接关闭后，同时解除相关事件绑定
            socket.removeEventListener('open', onOpen);
            socket.removeEventListener('message', onMessage);
            socket.removeEventListener('error', onError);
            socket.removeEventListener('close', onClose);
        };

        this.socket = socket;

        socket.addEventListener('open', onOpen);
        socket.addEventListener('message', onMessage);
        socket.addEventListener('error', onError);
        socket.addEventListener('close', onClose);
    }


    /**
     * 关闭 WebSocket 连接
     * 默认情况下，取消所有订阅的事件后，自动关闭连接
     */
    public close() {
        const { socket } = this;
        if (socket) {
            // 正在关闭或者已经关闭，退出
            const state = socket.readyState;
            if (state === 2 || state === 3) {
                return;
            }
            socket.close();
        }
    }


    /**
     * 销毁实例
     */
    public destroy() {
        this.close();
        this.options = null as any;
        this.socket = null as any;
        this.dataSendStorage = null as any;
        this.defineEventStorage = null as any;
        this.socketListenerStorage = null as any;
        this.subscribeListenerStorage = null as any;
    }


    /**
     * 创建 WebSocket 实例
     * @private
     */
    private async createSocket() {
        let { url, protocols } = this.options;

        // TODO：这两个 await 可优化为并行，目前为串行
        if (isFunction(url)) {
            url = await url();
        }
        if (isFunction(protocols)) {
            protocols = await protocols();
        }

        return new WebSocket(url, protocols);
    }


    /**
     * 统计订阅事件数量处理器
     * @param type 1：订阅，-1：取消订阅
     * @private
     */
    private updateCount(type: 1 | -1) {
        const count = this.subscribeCount + type;
        this.subscribeCount = count;

        // 订阅，并且是第一次订阅的时候，自动发起 WebSocket 连接
        if (type === 1 && count === 1) {
            this.connect();
            return;
        }

        // 取消订阅，并且不存在任何的事件订阅处理器的时候，关闭连接
        if (type === -1 && count === 0) {
            this.close();
        }
    }


    /**
     * 触发 WebSocket 事件
     * @param evt
     * @param response
     * @private
     */
    private dispatchWebSocketEvent(evt: Event | MessageEvent | CloseEvent, response?: any) {
        const listenerList = this.socketListenerStorage[evt.type as WebSocketEventTypes];
        if (listenerList) {
            listenerList.forEach((handler: Function) => {
                handler(evt, response);
            });
        }
    }


    /**
     * 触发订阅事件
     * @param type
     * @param data
     * @private
     */
    private dispatchSubscribeEvent(type: keyof T, data: any) {
        const listenerList = this.subscribeListenerStorage[type as string];
        if (listenerList) {
            listenerList.forEach((handler: Function) => {
                handler(data);
            });
        }
    }


    /**
     * 识别事件
     * @param response
     * @private
     */
    private recognizeEvent(response: object) {
        const { recognizer } = this.options;

        // 通过全局事件识别器
        // 当识别逻辑简单清晰时，推荐使用全局识别
        if (isFunction(recognizer)) {
            const eventType = recognizer(response);
            if (eventType) {
                this.dispatchSubscribeEvent(eventType, response);
            }
            return;
        }

        const { defineEventStorage } = this;

        // 通过独立事件识别器
        // 识别事件逻辑复杂，建议使用每个事件独立的事件识别器
        for (const key in defineEventStorage) {
            if (defineEventStorage.hasOwnProperty(key)) {
                const event = defineEventStorage[key] as DefineEventOptions;
                const recognizer = event.recognizer;

                if (isFunction(recognizer) && recognizer(response)) {
                    this.dispatchSubscribeEvent(key, response);
                    break;
                }
            }
        }
    }
}


export default WebSocketConnect;
