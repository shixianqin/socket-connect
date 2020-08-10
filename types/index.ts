export interface WebSocketConnectOptions<T> {
    url: string | (() => Promise<string>);

    protocols?: string | string[] | (() => Promise<string | string[]>);

    transformResponse?(evt: MessageEvent): Response;

    recognizer?(response: Response): keyof T | void;
}

export type Response = object;

export type WebSocketEventTypes = keyof WebSocketEventMap;

export type SendData = object | number | string | boolean; // string | ArrayBufferLike | Blob | ArrayBufferView;

export type SocketListener<K extends WebSocketEventTypes> = (evt: WebSocketEventMap[K], response?: Response) => void;

export type SubscribeListener<T = Response> = (data: T) => void;

export interface ListenerStorage {
    [key: string]: Function[];
}

export type SocketListenerStorage = {
    [key in WebSocketEventTypes]?: SocketListener<key>[];
}

export interface SubscribeListenerStorage {
    [key: string]: SubscribeListener[];
}

export interface DefineEventOptions {
    recognizer?(response: any): boolean;

    subscribe?(data?: object): SendData;

    update?(data: object): SendData;

    unsubscribe?(): SendData;

}