import { useCallback, useEffect, useRef, useState } from 'react'

export default function useChatThreadScroll({ threadId, messages = [], currentUserId }) {
  const scrollerRef = useRef(null)
  const endRef = useRef(null)
  const lastMessageCountRef = useRef(0)
  const stickToBottomRef = useRef(true)
  const [showJumpBottom, setShowJumpBottom] = useState(false)
  const [unreadBelow, setUnreadBelow] = useState(0)

  const scrollToLatest = useCallback((behavior = 'auto') => {
    stickToBottomRef.current = true
    setShowJumpBottom(false)
    setUnreadBelow(0)
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ block: 'end', behavior })
    })
  }, [])

  useEffect(() => {
    lastMessageCountRef.current = 0
    stickToBottomRef.current = true
    setShowJumpBottom(false)
    setUnreadBelow(0)
  }, [threadId])

  useEffect(() => {
    if (!threadId) return

    const previousCount = lastMessageCountRef.current
    const added = Math.max(0, messages.length - previousCount)
    const lastMessage = messages[messages.length - 1]
    const ownLatest = lastMessage?.sender_user_id === currentUserId
    const shouldFollow = previousCount === 0 || stickToBottomRef.current || ownLatest

    lastMessageCountRef.current = messages.length

    if (shouldFollow) {
      scrollToLatest(previousCount === 0 ? 'auto' : 'smooth')
      return
    }

    if (added > 0) {
      setUnreadBelow((count) => count + added)
      setShowJumpBottom(true)
    }
  }, [threadId, messages, currentUserId, scrollToLatest])

  const onScroll = useCallback(() => {
    const node = scrollerRef.current
    if (!node) return
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight
    const nearBottom = distanceFromBottom <= 96
    stickToBottomRef.current = nearBottom
    setShowJumpBottom(!nearBottom)
    if (nearBottom) setUnreadBelow(0)
  }, [])

  const markOutgoing = useCallback(() => {
    stickToBottomRef.current = true
  }, [])

  return {
    scrollerRef,
    endRef,
    showJumpBottom,
    unreadBelow,
    scrollToLatest,
    onScroll,
    markOutgoing,
  }
}
