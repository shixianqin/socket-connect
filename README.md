# WebSocketConnect
灵活控制、轻量、易用的订阅机制的 WebSocket 连接实现方案


## 安装
```
npm i web-socket-connect -S
```

## Demo


### TS 类型声明
`PAD` 的意思是 Params And Data  
`PADGroup` 的意思是 Params And Data Group

声明类型结构必须如下：
```typescript
import { PAD } from "web-socket-connect";

interface PADGroup {
    [key: string]: PAD<Params, Data>;
};

interface PADGroup {
    [key: string]: {
        Params: any;
        Data: any;
    }
};

interface PADGroup {
    abc: PAD<{ abcName: string; abcAge: number }, { abcInfo: any, abcLikes: string[] }>;
    def: PAD<{ defName: string; defAge: number }, { defInfo: any, defLikes: string[] }>;
}
```

### 创建实例
类型和全部的选项都是可选的
```typescript
import WebSocketConnect from "web-socket-connect";

const connect = new WebSocketConnect<PADGroup>({
    // 是否在意外中断时重新连接，可选
    // 传递 true 则默认延迟 5s 后自动重新连接
    // 传递数字可自定义延迟时间，单位（ms）
    autoReconnect: true,

    // 格式化响应后的数据，可选
    transform(res: any) {
        return JSON.parse(res);
    },

    // 唯一信号识别者，可选
    recognizer(data: any) {
        switch (data.type) {
            case 1:
                return 'abc';

            case 2:
                return 'def';
        }
    },

    // 当 WebSocket 实例创建后触发的事件，可选
    onWebSocketCreated(socket: WebSocket) {
        // do something...
    }
});
```


### 初始化连接
首次需要手动执行，这样设计更加灵活，你可以从任何地方开始  
该方法重复执行无效，内部有去重机制
```typescript
connect.connect('wss://www.demo.com/socket');

// use protocols
connect.connect('wss://www.demo.com/socket', 'protocolA');
connect.connect('wss://www.demo.com/socket', ['protocolA', 'protocolB']);
```


### 心跳连接
重复执行会叠加，一般不这么做
```typescript
connect.ping(5000, {data: 'ping'});

// 通过函数获取参数
connect.ping(5000, () => {
    return {
        data: 'ping' + Date.now()
    }
});
```


### 绑定/移除 socket 事件监听器
可执行多次绑定
```typescript
connect.on('open', (evt) => {
    // do something...
});
connect.on('message', (evt) => {
    // do something...
});
connect.on('error', (evt) => {
    // do something...
});
connect.on('close', (evt) => {
    // do something...
});

// 仅绑定一次
connect.once('open', (evt) => {
    // do something...
});

// 解绑，需要传递绑定时同样的函数引用和事件名称，类似 removeEventListener
function onOpen(evt: Event) {
    // do something...
}

connect.on('open', onOpen);
connect.off('open', onOpen);
```


### 拦截订阅信号
全部选项可选，重复配置相同的类型会覆盖  
`subscribe`、`update`、`unsubscribe` 钩子如果没有返回值或者返回值为 `undefined`，那么最终不会发送数据，相当于取消执行
```typescript
connect.interceptor("abc", {
    // 独立识别者，如果配置了唯一识别，这里将不会被执行，可选
    recognizer(data: any): boolean {
        return data.type === 1;
    },

    // 订阅动作钩子，可选
    // 仅在首次订阅该信号时会触发
    // params 参数不一定存在
    subscribe(params?): any {
        // do something...
        return params;
    },

    // 更新订阅参数动作钩子，可选
    // 从首次到之后的更新都会触发，除了取消订阅信号之外
    // params 参数一定会存在
    update(params): any {
        // do something...
        return params;
    },

    // 取消订阅动作钩子，可选
    // 仅在最后一次取消订阅该信号时触发
    // 如果取消订阅没有传递参数，则参数是发起订阅时或最后更新的参数
    // params 参数不一定存在
    unsubscribe(params?): any {
        // do something...
        return params;
    }
});
```


### 订阅/更新订阅/取消订阅
可执行多次订阅
```typescript
connect.subscribe("abc", (data) => {
    // do something...
});

// 订阅时同时带参数
connect.subscribe(
    "abc",
    (data) => {
        // do something...
    },
    {
        abcName: 'Abc name',
        abcAge: 1
    }
);

// 更新订阅参数
connect.update("abc", {
    abcName: 'Update abc name',
    abcAge: 2
});

// 取消订阅，需要传递订阅时同样的函数引用和信号名称，类似 removeEventListener
function abcSubscriber(data: PADGroup['abc']['Data']) {
    // do something...
}

connect.subscribe('abc', abcSubscriber);
connect.unsubscribe('abc', abcSubscriber);

// 取消订阅同时带参数
connect.unsubscribe("abc", abcSubscriber, {
    abcName: 'abc name',
    abcAge: 3
});
```


### 关闭连接
默认仅关闭连接  
关闭后，socket 事件监听器依然保留，下次重新连接时依然会被触发  
如果传递了参数 true，则关闭后，之前的订阅监听器会全部清空，但仍然可以发起新的订阅和重新连接
```typescript
connect.close();

// 关闭并清除全部订阅监听器
connect.close(true);
```


### 销毁实例
销毁后同时关闭了连接，移除了全部的事件绑定和对象的引用  
实例被强行破坏，不可在再发起新的订阅和重新连接
```typescript
connect.destroy();
```
