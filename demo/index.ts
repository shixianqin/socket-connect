import WebSocketConnect from "../src/index";

interface SubscribeEvents {
    myEvent: {
        a: 1,
        b: 22
    };
    eventA: '',
    eventB: ''
}

const wsc = new WebSocketConnect({
    url: 'wss://www.a.com/socket?a=1',
    transformResponse(evt: MessageEvent) {
        return {
            a: 1,
            b: 2
        }
    },
    // recognizer(response) {
    //
    //     if (Math.random() > 0.5) {
    //         return 'myEvent111'
    //     }
    //     return 'aabbbsd'
    // }
});

wsc.on('message', function (evt, res) {

});


// 定义事件
wsc.defineEvent('myEvent', {
    // 识别当前响应的是否为该事件类型
    recognizer(response: any): boolean {
        return response.type === 'myEvent';
    },

    // 订阅处理
    subscribe(data: object): any {
        return {
            Type: 1,
            ...data
        }
    },

    // 更新处理
    update(data: object): any {
        return {
            Type: 1,
            update: true,
            ...data
        }
    },

    // 取消订阅处理
    unsubscribe(): any {
        return {
            Type: 1,
            cancel: true
        }
    }
});


// 订阅事件
wsc.subscribe('myEvent', function (data) {

})