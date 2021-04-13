//
class Listener<K extends string, D = any, T extends Function = (data: D) => void> {
  private _map: { [key: string]: T[] } = {}

  add (type: K, listener: T) {
    const listeners = this._map[type]
    if (listeners) {
      listeners.push(listener)
      return
    }
    this._map[type] = [listener]
  }

  remove (type: K, listener: T) {
    const listeners = this._map[type]
    if (listeners) {
      const index = listeners.indexOf(listener)
      if (index >= 0) {
        listeners.splice(index, 1)
        return true
      }
    }
    return false
  }

  trigger (type: K, data: D) {
    const listeners = this._map[type]
    if (listeners) {
      listeners.forEach((listener) => {
        listener(data)
      })
    }
  }

  clear () {
    this._map = {}
  }

  count (type: K) {
    const listeners = this._map[type]
    return listeners ? listeners.length : 0
  }
}

export default Listener
