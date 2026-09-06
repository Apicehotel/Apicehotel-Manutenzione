export const DurableExecutor = Object.freeze({
  RAND: 'rand',
  TRIGGER_DEV: 'trigger.dev',
})

export function createDurableExecutorAdapter({ name = DurableExecutor.RAND, enqueue, cancel, status } = {}) {
  if (name !== DurableExecutor.RAND && name !== DurableExecutor.TRIGGER_DEV) throw new TypeError('Unsupported durable executor')
  if (name !== DurableExecutor.RAND && typeof enqueue !== 'function') throw new TypeError('External executor requires enqueue()')
  return Object.freeze({
    name,
    external: name !== DurableExecutor.RAND,
    enqueue: enqueue || null,
    cancel: typeof cancel === 'function' ? cancel : null,
    status: typeof status === 'function' ? status : null,
  })
}
