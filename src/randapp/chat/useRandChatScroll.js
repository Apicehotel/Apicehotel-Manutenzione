import { useCallback, useEffect, useRef, useState } from 'react'

export default function useRandChatScroll({ threadId, messages }) {
  const scrollRef = useRef(null)
  const autoScrollRef = useRef(true)
  const lastLengthRef = useRef(0)
  const [hitBottom, setHitBottom] = useState(true)

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const node = scrollRef.current
    if (!node) return
    autoScrollRef.current = true
    setHitBottom(true)
    requestAnimationFrame(() => node.scrollTo({ top: node.scrollHeight, behavior }))
  }, [])

  useEffect(() => {
    autoScrollRef.current = true
    lastLengthRef.current = 0
    setHitBottom(true)
    if (threadId) requestAnimationFrame(() => scrollToBottom('auto'))
  }, [threadId, scrollToBottom])

  useEffect(() => {
    if (!threadId) return
    const grew = messages.length > lastLengthRef.current
    if (grew && autoScrollRef.current) scrollToBottom(lastLengthRef.current ? 'smooth' : 'auto')
    lastLengthRef.current = messages.length
  }, [threadId, messages.length, scrollToBottom])

  const onScroll = useCallback(() => {
    const node = scrollRef.current
    if (!node) return
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight
    const atBottom = distance <= 72
    autoScrollRef.current = atBottom
    setHitBottom(atBottom)
  }, [])

  const followNextMessage = useCallback(() => {
    autoScrollRef.current = true
  }, [])

  return { scrollRef, hitBottom, scrollToBottom, onScroll, followNextMessage }
}
