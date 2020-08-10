import { ListenerStorage } from "../types/index";


/**
 * 添加事件
 * @param type 事件名
 * @param listener 事件监听器
 * @param storage 事件存储的对象
 */
export function addListener(type: string, listener: Function, storage: ListenerStorage) {
    const listenerList = storage[type];
    if (listenerList) {
        listenerList.push(listener);
    } else {
        storage[type] = [listener];
    }
}


/**
 * 移除事件
 * @param type 事件名
 * @param listener 事件监听器
 * @param storage 事件存储的对象
 * @returns false：移除失败，true：移除成功，'EMPTY'：全部移除
 */
export function removeListener(type: string, listener: Function, storage: ListenerStorage): boolean | 'EMPTY' {
    const listenerList = storage[type];
    if (listenerList) {
        const index = listenerList.indexOf(listener);
        if (index >= 0) {
            listenerList.splice(index, 1);
            if (listenerList.length === 0) {
                delete storage[type];
                return 'EMPTY';
            }
            return true;
        }
    }
    return false;
}


/**
 * 判断一个值是否为一个函数
 * @param value
 */
export function isFunction(value: any): value is Function {
    return typeof value === 'function';
}


/**
 * 使指定的对象的指定属性不可枚举
 * @param obj
 * @param key
 * @param value
 */
export function hideProperty(obj: object, key: string, value?: any) {
    Object.defineProperty(obj, key, {
        value,
        enumerable: false
    });
}