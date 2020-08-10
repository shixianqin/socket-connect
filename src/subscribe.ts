import WebSocketConnect from "./index";
import { SendData, SubscribeListener } from "../types/index";
import { hideProperty } from "./utils";

class Subscribe<T extends object, K extends keyof T> {
    public constructor(
        private connect: WebSocketConnect<T>,
        private readonly type: K,
        private listener: SubscribeListener<T[K]>
    ) {
        hideProperty(this, 'connect', connect);
        hideProperty(this, 'type', type);
        hideProperty(this, 'listener', listener);
    }


    /**
     * 移除/取消订阅
     */
    public remove() {
        this.connect.unsubscribe(this.type, this.listener);
        this.connect = null as any;
        this.listener = null as any;
    }


    /**
     * 更新订阅
     * @param data
     */
    public update(data: SendData) {
        this.connect.dispatchAction('update', this.type, data);
    }
}

export default Subscribe;