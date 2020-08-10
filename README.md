# WebSocketConnect
+ 文档还不是很详细，后续有时间再补充。


### 注意⚠️
+ 事件识别是最核心的处理，想要订阅某个事件，一定是需要先识别它


### 创建实例
```typescript
const wsc = new WebSocketConnect({
    // url: 'wss://www.demo.com/socket?a=1&b=2',

    // url 可以是一个函数，返回 promise
    async url() {
       const res = await fetch('https://www.demo.com/get-socket-url');
       return res.url;
    },
 
    // protocols 同时也可以是一个函数，返回 promise，类似 url
    protocols: ['a1', 'b2'],
    
    // 处理响应后的数据
    transformResponse(evt: MessageEvent) {
        // 格式化数据后返回
    },

    // 全局事件识别
    recognizer(response) {
        // 识别事件
        if(response.type === 1) {
            return 'eventA'
        }
        return 'eventB'
    }
});
```


### WebSocket 事件监听和移除
```typescript
wsc.on('open', function (evt) {
  // 
});

wsc.on('message', function (evt) {
  // 
});

wsc.on('error', function (evt) {
  // 
});

wsc.on('close', function (evt) {
  // 
});

// 仅监听一次
wsc.once('open', function () {
 // 
});

// 移除示例
const openListener = (evt) => {
};
wsc.on('open', openListener);
wsc.off('open', openListener); // 移除的函数必须绑定的函数
```


### 事件订阅/取消订阅
```typescript
wsc.subscribe('eventA', function (res) {

});

// 取消订阅示例
function eventAListener(res) {
}
const eventA = wsc.subscribe('eventA', eventAListener);
// 第一种移除方式
eventA.remove();

// 第二种移除方式
wsc.unsubscribe('eventA', eventAListener);


// 更新订阅
eventA.update({
    a: 1,
    b: 2
});
```


### 事件定义
```typescript
wsc.defineEvent('eventA', {
    recognizer(res){
        return res.type === 1; // 事件识别，如果注入了全局的事件识别器，这里的识别器将不会被触发
    },
    subscribe(){}, // 订阅
    unsubscribe(){}, // 取消订阅
    update(){} // 更新
})
```


### 发送数据
```typescript
wsc.send({
    a: 1,
    b: 2
});
```