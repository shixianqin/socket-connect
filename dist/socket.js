(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["Socket"] = factory();
	else
		root["Socket"] = factory();
})(self, function() {
return /******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	// The require scope
/******/ 	var __webpack_require__ = {};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  "default": () => (/* binding */ src)
});

;// CONCATENATED MODULE: ./src/listener.ts
var Listener = (function () {
    function Listener() {
        this._map = {};
    }
    Listener.prototype.add = function (type, listener) {
        var listeners = this._map[type];
        if (listeners) {
            listeners.push(listener);
            return;
        }
        this._map[type] = [listener];
    };
    Listener.prototype.remove = function (type, listener) {
        var listeners = this._map[type];
        if (listeners) {
            var index = listeners.indexOf(listener);
            if (index >= 0) {
                listeners.splice(index, 1);
                return true;
            }
        }
        return false;
    };
    Listener.prototype.trigger = function (type, data) {
        var listeners = this._map[type];
        if (listeners) {
            listeners.forEach(function (listener) {
                listener(data);
            });
        }
    };
    Listener.prototype.clear = function () {
        this._map = {};
    };
    Listener.prototype.count = function (type) {
        var listeners = this._map[type];
        return listeners ? listeners.length : 0;
    };
    return Listener;
}());
/* harmony default export */ const listener = (Listener);

;// CONCATENATED MODULE: ./src/index.ts

var Socket = (function () {
    function Socket(options) {
        this._subscribeCount = 0;
        this._queueData = [];
        this._paramsCache = {};
        this._recognizers = [];
        this._interceptors = {};
        this._socketListener = new listener();
        this._subscribeListener = new listener();
        this._options = options || {};
    }
    Socket.prototype.on = function (type, listener) {
        this._socketListener.add(type, listener);
    };
    Socket.prototype.once = function (type, listener) {
        var _this = this;
        var _listener = function (evt) {
            listener(evt);
            _this.off(type, _listener);
        };
        this.on(type, _listener);
    };
    Socket.prototype.off = function (type, listener) {
        this._socketListener.remove(type, listener);
    };
    Socket.prototype.subscribe = function (type, listener, params) {
        this._subscribeListener.add(type, listener);
        this._updateCount(1);
        if (this._subscribeListener.count(type) === 1) {
            this._dispatchAction('subscribe', type, params);
        }
        if (params) {
            this.update(type, params);
        }
    };
    Socket.prototype.subscribeOnce = function (type, listener, params) {
        var _this = this;
        var _listener = function (data) {
            listener(data);
            _this.unsubscribe(type, _listener, params);
        };
        this.subscribe(type, _listener, params);
    };
    Socket.prototype.update = function (type, params) {
        if (this._subscribeListener.count(type) > 0) {
            this._dispatchAction('update', type, params);
        }
    };
    Socket.prototype.unsubscribe = function (type, listener, params) {
        if (this._subscribeListener.remove(type, listener)) {
            this._updateCount(-1);
            if (this._subscribeListener.count(type) === 0) {
                this._dispatchAction('unsubscribe', type, params);
            }
        }
    };
    Socket.prototype.connect = function (url, protocols) {
        var _this = this;
        var socket = this._createSocket(url, protocols);
        if (!socket) {
            return;
        }
        var _a = this._options, transform = _a.transform, reconnect = _a.reconnect, onWebSocketCreated = _a.onWebSocketCreated;
        var trigger = function (evt) {
            _this._socketListener.trigger(evt.type, evt);
        };
        var onOpen = function (evt) {
            trigger(evt);
            _this._sendQueue();
        };
        var onMessage = function (evt) {
            trigger(evt);
            _this._recognize(transform ? transform(evt.data) : evt.data);
        };
        var onError = function (evt) {
            trigger(evt);
        };
        var onClose = function (evt) {
            trigger(evt);
            if (evt.code !== 1000 && reconnect) {
                _this._reconnect(reconnect);
            }
            if (_this._destroying) {
                _this._clearReferences();
            }
            socket.removeEventListener('open', onOpen);
            socket.removeEventListener('message', onMessage);
            socket.removeEventListener('error', onError);
            socket.removeEventListener('close', onClose);
        };
        if (onWebSocketCreated) {
            onWebSocketCreated(socket);
        }
        socket.addEventListener('open', onOpen);
        socket.addEventListener('message', onMessage);
        socket.addEventListener('error', onError);
        socket.addEventListener('close', onClose);
    };
    Socket.prototype.ping = function (interval, params) {
        var _this = this;
        var timer;
        var cancel = function () {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };
        var send = function () {
            cancel();
            timer = setTimeout(function () {
                send();
                _this.send(typeof params === 'function' ? params() : params);
            }, interval);
        };
        this.on('open', send);
        this.on('message', send);
        this.on('close', cancel);
    };
    Socket.prototype.interceptor = function (type, options) {
        this._interceptors[type] = options;
        if (options.recognizer) {
            this._recognizers.push({
                type: type,
                recognizer: options.recognizer
            });
        }
    };
    Socket.prototype.send = function (data) {
        if (typeof data !== 'string') {
            data = JSON.stringify(data);
        }
        var _socket = this._socket;
        if (_socket && _socket.readyState === 1) {
            _socket.send(data);
            return;
        }
        this._queueData.push(data);
    };
    Socket.prototype.close = function (clear) {
        if (this._connecting()) {
            if (clear) {
                this._socketListener.clear();
                this._subscribeListener.clear();
            }
            this._socket.close(1000);
        }
    };
    Socket.prototype.destroy = function () {
        this._destroying = true;
        this.close(true);
    };
    Socket.prototype._createSocket = function (url, protocols) {
        this._url = url;
        this._protocols = protocols;
        if (this._connecting() || this._subscribeCount === 0) {
            return;
        }
        this._cancelReconnect();
        var socket = new WebSocket(url, protocols);
        this._socket = socket;
        return socket;
    };
    Socket.prototype._reconnect = function (timeout) {
        var _this = this;
        this._reconnectTimer = setTimeout(function () {
            _this._reconnectTimer = null;
            _this._queueData = Object.values(_this._paramsCache);
            _this.connect(_this._url, _this._protocols);
        }, typeof timeout === 'number' ? timeout : 5000);
    };
    Socket.prototype._connecting = function () {
        var _socket = this._socket;
        if (_socket) {
            var state = _socket.readyState;
            return state === 0 || state === 1;
        }
        return false;
    };
    Socket.prototype._sendQueue = function () {
        var _this = this;
        if (this._queueData.length > 0) {
            this._queueData.forEach(function (data) {
                _this._socket.send(data);
            });
            this._queueData = [];
        }
    };
    Socket.prototype._dispatchAction = function (action, type, params) {
        var cache = this._paramsCache;
        var interceptor = this._interceptors[type];
        var handler = interceptor && interceptor[action];
        var updateKey = type + ".update";
        var subscribeKey = type + ".subscribe";
        if (handler) {
            params = handler(params, cache[updateKey], cache[subscribeKey]);
        }
        if (params !== void 0) {
            switch (action) {
                case 'subscribe':
                case 'update':
                    cache[type + "." + action] = params;
                    break;
                case 'unsubscribe':
                    delete cache[subscribeKey];
                    delete cache[updateKey];
                    break;
            }
            this.send(params);
        }
    };
    Socket.prototype._recognize = function (data) {
        var _this = this;
        var recognizer = this._options.recognizer;
        if (recognizer) {
            var type = recognizer(data);
            if (type === false) {
                return;
            }
            if (type) {
                var trigger = function (t) {
                    _this._triggerSubscriber(t, data);
                };
                return type instanceof Array ? type.forEach(trigger) : trigger(type);
            }
        }
        var _recognizers = this._recognizers;
        if (_recognizers.length > 0) {
            _recognizers.some(function (item) {
                if (item.recognizer(data)) {
                    _this._triggerSubscriber(item.type, data);
                    return true;
                }
            });
        }
    };
    Socket.prototype._triggerSubscriber = function (type, data) {
        var interceptor = this._interceptors[type];
        if (interceptor && interceptor.transform) {
            data = interceptor.transform(data);
        }
        this._subscribeListener.trigger(type, data);
    };
    Socket.prototype._updateCount = function (action) {
        this._subscribeCount += action;
        if (action === 1 && this._cancelAutoClose()) {
            return;
        }
        if (action === 1 && this._subscribeCount === 1 && this._url && !this._connecting()) {
            this.connect(this._url, this._protocols);
            return;
        }
        if (action === -1 && this._subscribeCount === 0) {
            this._autoClose();
        }
    };
    Socket.prototype._autoClose = function () {
        var _this = this;
        this._autoCloseTimer = setTimeout(function () {
            _this._autoCloseTimer = null;
            _this.close();
        }, 5000);
    };
    Socket.prototype._cancelReconnect = function () {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
        }
    };
    Socket.prototype._cancelAutoClose = function () {
        if (this._autoCloseTimer) {
            clearTimeout(this._autoCloseTimer);
            this._autoCloseTimer = null;
            return true;
        }
    };
    Socket.prototype._clearReferences = function () {
        var _null = null;
        this._options = _null;
        this._socket = _null;
        this._url = _null;
        this._protocols = _null;
        this._queueData = _null;
        this._paramsCache = _null;
        this._recognizers = _null;
        this._interceptors = _null;
        this._socketListener = _null;
        this._subscribeListener = _null;
    };
    return Socket;
}());
/* harmony default export */ const src = (Socket);


__webpack_exports__ = __webpack_exports__.default;
/******/ 	return __webpack_exports__;
/******/ })()
;
});