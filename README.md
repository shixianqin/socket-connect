# Socket

采用信号订阅机制的 WebSocket 连接实现方案。

### 安装

```
npm i @awesomejs/socket -S
```

### 请求参数/响应数据的 TS 类型声明规则

`PAD` 表示为 Params And Data  
`PADGroup` 表示为 Params And Data Group

声明类型结构必须如下：

```typescript
import { PAD } from "@awesomejs/socket"

// 格式 1
interface PADGroup {
  [key: string]: PAD<Params, Data>
}

// 格式 2
interface PADGroup {
  [key: string]: {
    Params: any
    Data: any
  }
}

// 定义类型
interface PADGroup {
  abc: PAD<{ abcName: string; abcAge: number }, { abcInfo: any; abcLikes: string[] }>
  def: PAD<{ defName: string; defAge: number }, { defInfo: any; defLikes: string[] }>
}
```

### 演示

#### 实例创建

```typescript
import Socket from "@awesomejs/socket"

const skt = new Socket<PADGroup>({
  // 是否在意外中断时重新连接，可选
  // 传递 true 则默认延迟 5s 后自动重新连接
  // 传递数字可自定义延迟时间，单位（ms）
  reconnect: true,

  // 格式化响应后的数据，可选
  transform (res: any) {
    return JSON.parse(res)
  },

  // 信号识别器，可选
  recognizer (data: any) {
    switch (data.type) {
      case 1:
        return 'abc' // 识别为 'abc'

      case 2:
        return 'def' // 识别为 'def'

      case 3:
        return ['abc', 'def'] // 同时识别为 'abc' 和 'def'

      case -1:
        return false // 拒绝处理，返回 false 可防止程序继续往下执行独立识别
    }
    // 不返回或者返回 undefined 则表示未成功识别
  },

  // 当 WebSocket 实例创建后触发的事件
  // 这时候可以直接获得 socket 对象
  onWebSocketCreated (socket: WebSocket) {
    // do something...
  }
})
```

### 初始化连接

可以从任何地方任何位置发起连接，如果此时还没有任何的订阅事件，则实际上不会真正发起连接，等到第一次订阅信号发起的时候程序才会自动发起真实的连接，无论如何，你必须得先手动执行 connect 方法。

```typescript
skt.connect('wss://www.demo.com/socket')

// use protocols
skt.connect('wss://www.demo.com/socket', 'protocolA')
skt.connect('wss://www.demo.com/socket', ['protocolA', 'protocolB'])
```

### 心跳连接

重复执行会叠加，一般你也不会想这样做

```typescript
skt.ping(5000, { data: 'ping' })

// 通过函数获取参数
skt.ping(5000, () => {
  return {
    data: 'ping' + Date.now()
  }
})
```

### 绑定/移除 socket 事件监听器

可执行多次绑定，就如同 `addEventListener` 和 `removeEventListener`

```typescript
skt.on('open', (evt) => {
  // do something...
})

skt.on('message', (evt) => {
  // do something...
})

skt.on('error', (evt) => {
  // do something...
})

skt.on('close', (evt) => {
  // do something...
})

// 仅绑定一次
skt.once('open', (evt) => {
  // do something...
})

// 解绑，需要传递绑定时同样的函数引用和事件名称
function opener (evt: Event) {
  // do something...
}

skt.on('open', opener)
skt.off('open', opener)
```

### 定义信号拦截器

在此可做数据转换，定义独立识别器，参数加装等  
`subscribe`、`update`、`unsubscribe` 钩子如果没有返回值或者返回值为 `undefined`，那么最终不会发送数据，相当于取消执行

```typescript
skt.interceptor("abc", {
  /**
   * 独立识别器，可选
   * @param data 响应的数据
   */
  recognizer (data: any): boolean {
    return data.type === 1
  },

  /**
   * 转换数据
   * @param data
   */
  transform (data: any) {
    return data
  },

  /**
   * 订阅动作钩子，可选
   * 仅在首次订阅该信号时会触发
   *
   * @param params 订阅时的参数
   */
  subscribe (params?): any {
    // do something...
    return {
      ...params,
      type: 1 // 加装参数
    }
  },

  /**
   * 更新订阅参数动作钩子，可选
   * 更新订阅参数时触发
   * 如果第一次订阅时传递了参数，也会触发此钩子
   *
   * @param params 更新订阅的参数
   * @param prevUpdateParams 上一次更新订阅的参数
   * @param subscribeParams 发起订阅时的参数
   */
  update (params, prevUpdateParams?, subscribeParams?): any {
    // do something...
    return params
  },

  /**
   * 取消订阅动作钩子，可选
   * 仅在最后一次取消订阅时触发
   * 如果取消订阅没有传递参数，则参数是发起订阅时或最后更新的参数
   *
   * @param params 取消订阅的参数 或者 最后更新的参数 或者 发起订阅时的参数
   * @param lastUpdateParams 最后一次更新的参数
   * @param subscribeParams 发起订阅时的参数
   */
  unsubscribe (params, lastUpdateParams?, subscribeParams?): any {
    // do something...
    return params
  }
})
```

#### 信号订阅/更新订阅/取消订阅

```typescript
skt.subscribe("abc", (data) => {
  // do something...
})

// 订阅时同时带参数
skt.subscribe(
  "abc",
  (data) => {
    // do something...
  },
  {
    abcName: 'Abc name',
    abcAge: 1
  }
)

// 更新订阅参数
skt.update("abc", {
  abcName: 'Update abc name',
  abcAge: 2
})

// 取消订阅，需要传递订阅时同样的函数引用和信号名称，类似 removeEventListener
function abcSubscriber (data: PADGroup['abc']['Data']) {
  // do something...
}

skt.subscribe('abc', abcSubscriber)
skt.unsubscribe('abc', abcSubscriber)

// 取消订阅同时带参数
skt.unsubscribe("abc", abcSubscriber, {
  abcName: 'abc name',
  abcAge: 3
})
```

#### 关闭连接

默认仅关闭连接，关闭后，socket事件监听器和信号订阅监听器依然保留，下次重新连接时依然会被触发  
如果传递了参数 true，则关闭后，之前的事件监听器/信号订阅监听器会全部清空，但仍然可以发起新的订阅和重新连接

```typescript
skt.close()

// 关闭并清除全部事件/订阅监听器
skt.close(true)
```

#### 销毁实例

销毁后同时关闭了连接，移除了全部的事件绑定和对象的引用  
实例被强行破坏，不可在再发起新的订阅和重新连接

```typescript
skt.destroy()
```
