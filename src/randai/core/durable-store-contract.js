export function assertDurableStore(store) {
  for (const method of ['get', 'put', 'byKey', 'bindKey']) {
    if (typeof store?.[method] !== 'function') throw new TypeError(`Durable store requires ${method}()`)
  }
  return store
}
