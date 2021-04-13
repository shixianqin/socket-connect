import {
  Options,
  SocketEvents,
  PADGroup,
  Interceptor,
  Actions,
  Recognizer
} from '../types'

import Listener from './listener'

// @ts-ignore
class Socket<T extends object = any, Types extends string = keyof T, PADG extends PADGroup = T> {
  private _options: Options<Types>
  private _socket?: WebSocket
  private _url?: string
  private _protocols?: string | string[]
  private _reconnectTimer?: any
  private _autoCloseTimer?: any
  private _destroying?: boolean
  private _subscribeCount: number = 0

  // 未连接成功时的发送的数据缓存
  private _queueData: string[] = []

  // 订阅参数缓存，提供给重新连接时还原状态
  // 缓存键值如下：
  // [type].subscribe = Params;
  // [type].update = Params;
  private _paramsCache: { [K: string]: PADG[Types]['Params'] } = {}

  // 独立识别器集合
  private _recognizers: Recognizer<Types>[] = []

  // 拦截订阅信号配置
  private _interceptors: { [K in Types]?: Interceptor<PADG[K]> | undefined } = {}

  // WebSocket 事件监听器
  private _socketListener = new Listener<SocketEvents, Event & MessageEvent & CloseEvent>()

  // 订阅信号事件监听器
  private _subscribeListener = new Listener<Types, PADG[Types]['Data']>()

  constructor (options?: Options<Types>) {
    this._options = options || {}
  }

  /**
   * 绑定 socket 事件监听器
   * @param type
   * @param listener
   */
  on<K extends SocketEvents> (type: K, listener: (evt: WebSocketEventMap[K]) => void) {
    this._socketListener.add(type, listener)
  }

  /**
   * 绑定 socket 事件监听器（仅一次）
   * @param type
   * @param listener
   */
  once<K extends SocketEvents> (type: K, listener: (evt: WebSocketEventMap[K]) => void) {
    const _listener = (evt: WebSocketEventMap[K]) => {
      listener(evt)
      this.off(type, _listener)
    }
    this.on(type, _listener)
  }

  /**
   * 移除 socket 事件监听器
   * @param type
   * @param listener
   */
  off<K extends SocketEvents> (type: K, listener: (evt: WebSocketEventMap[K]) => void) {
    this._socketListener.remove(type, listener)
  }

  /**
   * 订阅信号
   * @param type
   * @param listener
   * @param params
   */
  subscribe<K extends Types> (type: K, listener: (data: PADG[K]['Data']) => void, params?: PADG[K]['Params']) {
    this._subscribeListener.add(type, listener)
    this._updateCount(1)

    // 第一次订阅当前信号的时候，触发动作为 subscribe
    if (this._subscribeListener.count(type) === 1) {
      this._dispatchAction('subscribe', type, params)
    }

    // 如果传递了参数则触发 update 动作
    if (params) {
      this.update(type, params)
    }
  }

  /**
   * 订阅信号（仅一次）
   * @param type
   * @param listener
   * @param params
   */
  subscribeOnce<K extends Types> (type: K, listener: (data: PADG[K]['Data']) => void, params?: PADG[K]['Params']) {
    const _listener = (data: PADG[K]['Data']) => {
      listener(data)
      this.unsubscribe(type, _listener, params)
    }
    this.subscribe(type, _listener, params)
  }

  /**
   * 更新订阅信号参数
   * @param type
   * @param params
   */
  update<K extends Types> (type: K, params: PADG[K]['Params']) {
    if (this._subscribeListener.count(type) > 0) {
      this._dispatchAction('update', type, params)
    }
  }

  /**
   * 取消订阅信号
   * @param type
   * @param listener
   * @param params
   */
  unsubscribe<K extends Types> (type: K, listener: (data: PADG[K]['Data']) => void, params?: PADG[K]['Params']) {
    if (this._subscribeListener.remove(type, listener)) {
      this._updateCount(-1)

      // 当前订阅的信号已经全部取消，触发 unsubscribe 动作
      if (this._subscribeListener.count(type) === 0) {
        this._dispatchAction('unsubscribe', type, params)
      }
    }
  }

  /**
   * 启动连接，初始化需手动执行
   * @param url
   * @param protocols
   */
  connect (url: string, protocols?: string | string[]) {
    const socket = this._createSocket(url, protocols)

    // 创建实例，如果创建失败则退出
    if (!socket) {
      return
    }

    const { transform, reconnect, onWebSocketCreated } = this._options

    const trigger = (evt: any) => {
      this._socketListener.trigger(evt.type, evt)
    }

    const onOpen = (evt: Event) => {
      trigger(evt)
      this._sendQueue() // 连接成功后，立即发送在排队的数据
    }

    const onMessage = (evt: MessageEvent) => {
      trigger(evt)
      this._recognize(transform ? transform(evt.data) : evt.data) // 执行事件识别处理
    }

    const onError = (evt: Event) => {
      trigger(evt)
    }

    const onClose = (evt: CloseEvent) => {
      trigger(evt)

      if (evt.code !== 1000 && reconnect) {
        this._reconnect(reconnect) // 非正常关闭连接，并且配置了自动重新连接选项
      }

      if (this._destroying) {
        this._clearReferences() // 如果标识为销毁中，则清除全部的引用对象
      }

      // 实例销毁，连接关闭后，移除全部的 socket 事件监听器
      socket.removeEventListener('open', onOpen)
      socket.removeEventListener('message', onMessage)
      socket.removeEventListener('error', onError)
      socket.removeEventListener('close', onClose)
    }

    if (onWebSocketCreated) {
      onWebSocketCreated(socket)
    }

    // 添加 socket 事件监听器
    socket.addEventListener('open', onOpen)
    socket.addEventListener('message', onMessage)
    socket.addEventListener('error', onError)
    socket.addEventListener('close', onClose)
  }

  /**
   * 开启心跳连接
   * @param interval
   * @param params
   */
  ping (interval: number, params: any) {
    let timer: any

    // 取消 ping
    const cancel = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }

    // 发送 ping
    const send = () => {
      cancel()
      timer = setTimeout(() => {
        send()
        this.send(typeof params === 'function' ? params() : params)
      }, interval)
    }

    this.on('open', send)
    this.on('message', send)
    this.on('close', cancel)
  }

  /**
   * 拦截订阅信号
   * @param type
   * @param options
   */
  interceptor<K extends Types> (type: K, options: Interceptor<PADG[K]>) {
    this._interceptors[type] = options

    if (options.recognizer) {
      this._recognizers.push({
        type,
        recognizer: options.recognizer
      })
    }
  }

  /**
   * 发送数据，一般情况下不需要手动执行此方法
   * @param data
   */
  send (data: any) {
    if (typeof data !== 'string') {
      data = JSON.stringify(data)
    }

    const { _socket } = this

    // 如果已经连接成功，则可以立即发送数据
    if (_socket && _socket.readyState === 1) {
      _socket.send(data)
      return
    }

    // 为开始连接，或者为连接成功，先将数据存储在内存中，等待连接成功后在统一发送
    this._queueData.push(data)
  }

  /**
   * 手动关闭连接
   * @param clear
   */
  close (clear?: boolean) {
    if (this._connecting()) {

      // 清除全部的事件/订阅监听器
      if (clear) {
        this._socketListener.clear()
        this._subscribeListener.clear()
      }

      this._socket!.close(1000)
    }
  }

  /**
   * 销毁实例，同时关闭连接，执行此方法后，不可以再重新连接
   */
  destroy () {
    this._destroying = true
    this.close(true)
  }

  /**
   * 创建 WebSocket 实例
   * @private
   */
  private _createSocket (url: string, protocols?: string | string[]) {
    // 保存连接信息，提供给后续的自动连接
    this._url = url
    this._protocols = protocols

    // 正在连接或者已经连接成功，或者还未存在任何的订阅监听器，退出创建连接
    if (this._connecting() || this._subscribeCount === 0) {
      return
    }

    // 如果正在等待自动重新连接，则立即取消自动重连
    this._cancelReconnect()

    const socket = new WebSocket(url, protocols)

    this._socket = socket

    return socket
  }

  /**
   * 自动重连，仅在意外中断时
   * @param timeout
   * @private
   */
  private _reconnect (timeout: boolean | number) {
    // 默认延迟 5s 后自动重新连接，如果选项 reconnect 为数字，则使用 reconnect 值
    // 设置延迟 5s 是为了防止网络异常或者服务器异常情况时，导致发起过于频繁的连接
    this._reconnectTimer = setTimeout(
      () => {
        this._reconnectTimer = null
        this._queueData = Object.values(this._paramsCache)
        this.connect(this._url!, this._protocols)
      },
      typeof timeout === 'number' ? timeout : 5000
    )
  }

  /**
   * 是否正在连接中
   * @private
   */
  private _connecting () {
    const { _socket } = this
    if (_socket) {
      const state = _socket.readyState
      return state === 0 || state === 1
    }
    return false
  }

  /**
   * 发送排队的数据
   * @private
   */
  private _sendQueue () {
    // 并且发送完成后立即清空，避免后续重新连接时参数错误
    if (this._queueData.length > 0) {
      this._queueData.forEach((data) => {
        this._socket!.send(data)
      })
      this._queueData = []
    }
  }

  /**
   * 执行订阅信号，仅内部调用
   * @param action
   * @param type
   * @param params
   * @private
   */
  private _dispatchAction<K extends Types> (action: Actions, type: K, params?: PADG[K]['Params']) {
    const cache = this._paramsCache
    const interceptor = this._interceptors[type]
    const handler = interceptor && interceptor[action]

    const updateKey = `${type}.update`
    const subscribeKey = `${type}.subscribe`

    // 如果存在拦截配置，则先通过拦截
    if (handler) {
      params = handler(params, cache[updateKey], cache[subscribeKey])
    }

    // 如果得到的参数是 undefined，则不需要发送数据，
    // 因为没有参数，意味着没有任何东西会被改变
    if (params !== void 0) {

      switch (action) {
        // 订阅或更新，缓存参数
        // 1.可提供在自动重连的时候还原状态
        // 2.可在订阅生命周期钩子中传输
        case 'subscribe':
        case 'update':
          cache[`${type}.${action}`] = params
          break

        // 取消订阅，删除缓存的参数，避免重连时状态还原混乱
        case 'unsubscribe':
          delete cache[subscribeKey]
          delete cache[updateKey]
          break
      }

      this.send(params)
    }
  }

  /**
   * 事件识别
   * @param data
   * @private
   */
  private _recognize (data: any) {
    const { recognizer } = this._options

    // 通过全局信号识别器，一般情况下，建议配置全局识别
    if (recognizer) {
      const type = recognizer(data)

      // 如果强制返回 false，则表示拒绝处理本次数据响应
      if (type === false) {
        return
      }

      // 识别成功，则触发对应监听器，否则往下继续执行独立识别
      if (type) {
        const trigger = (t: Types) => {
          this._triggerSubscriber(t, data)
        }
        return type instanceof Array ? type.forEach(trigger) : trigger(type)
      }
    }

    // 通过独立信号识别器
    const { _recognizers } = this

    if (_recognizers.length > 0) {
      _recognizers.some((item) => {
        if (item.recognizer(data)) {
          this._triggerSubscriber(item.type, data)
          return true
        }
      })
    }
  }

  /**
   * 触发订阅监听器
   * @param type
   * @param data
   * @private
   */
  private _triggerSubscriber<K extends Types> (type: K, data: any) {
    const interceptor = this._interceptors[type]

    if (interceptor && interceptor.transform) {
      data = interceptor.transform(data)
    }

    this._subscribeListener.trigger(type, data)
  }

  /**
   * 统计订阅总次数
   * @param action 1:订阅，-1：取消订阅
   * @private
   */
  private _updateCount (action: 1 | -1) {
    this._subscribeCount += action

    // 如果是订阅动作，并且是正在等待自动关闭，则立即取消自动关闭
    // 因为有了新的订阅
    if (action === 1 && this._cancelAutoClose()) {
      return
    }

    // 如果是订阅动作，并且是第一次订阅，并且已经手动初始化连接，并且还没有连接
    // 则自动发起连接
    if (action === 1 && this._subscribeCount === 1 && this._url && !this._connecting()) {
      this.connect(this._url, this._protocols)
      return
    }

    // 如果是取消订阅动作，并且是最后一个取消
    // 自动关闭
    if (action === -1 && this._subscribeCount === 0) {
      this._autoClose()
    }
  }

  /**
   * 自动关闭连接
   * @private
   */
  private _autoClose () {
    // 则在延迟 5s 后，自动关闭连接，
    // 设置延迟关闭是为了防止快速的取消订阅又快速发起订阅的过程造成的连续性的重新连接又关闭又连接的情况
    this._autoCloseTimer = setTimeout(
      () => {
        this._autoCloseTimer = null
        this.close()
      },
      5000
    )
  }

  /**
   * 取消自动重连
   * @private
   */
  private _cancelReconnect () {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
  }

  /**
   * 取消自动关闭连接
   * @private
   */
  private _cancelAutoClose () {
    if (this._autoCloseTimer) {
      clearTimeout(this._autoCloseTimer)
      this._autoCloseTimer = null
      return true
    }
  }

  /**
   * 清除实例等引用类型，仅内部调用
   * @private
   */
  private _clearReferences () {
    const _null: any = null

    this._options = _null
    this._socket = _null
    this._url = _null
    this._protocols = _null
    this._queueData = _null
    this._paramsCache = _null
    this._recognizers = _null
    this._interceptors = _null
    this._socketListener = _null
    this._subscribeListener = _null
  }
}

export default Socket

export * from '../types'
