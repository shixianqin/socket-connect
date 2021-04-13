export type Actions = 'subscribe' | 'update' | 'unsubscribe'

export interface Options<T extends string> {
  reconnect?: boolean | number;

  transform? (res: any): any;

  recognizer? (data: any): false | void | T | T[];

  onWebSocketCreated? (socket: WebSocket): void;
}

export interface Interceptor<T extends PAD, P = T['Params']> {
  recognizer? (data: any): boolean;

  transform? (data: any): T['Data'];

  subscribe (params?: P): any;

  update (params: P, prevUpdateParams?: P, subscribeParams?: P): any;

  unsubscribe (params: P, lastUpdateParams?: P, subscribeParams?: P): any;
}

export type SocketEvents = keyof WebSocketEventMap;

export interface Recognizer<T extends string> {
  type: T,
  recognizer: (res: any) => boolean
}

export interface PAD<P = any, D = any> {
  Params: P;
  Data: D;
}

export interface PADGroup {
  [key: string]: PAD;
}
