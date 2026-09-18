import { useEffect, useRef } from 'react'
import { createRandHotelGame } from './RandHotelScene.js'

export default function RandAILiveGame({runtime,issues,onAgentSelect,onIssueSelect}){
  const hostRef=useRef(null)
  const gameRef=useRef(null)
  const issuesRef=useRef(issues)

  useEffect(()=>{issuesRef.current=issues},[issues])

  useEffect(()=>{
    if(!hostRef.current)return undefined
    const game=createRandHotelGame(hostRef.current)
    gameRef.current=game
    const handleAgent=(id)=>onAgentSelect?.(id)
    const handleIssue=(id)=>{
      const issue=issuesRef.current.find((item)=>String(item.id)===String(id))
      if(issue)onIssueSelect?.(issue)
    }
    game.events.on('randailive:agent',handleAgent)
    game.events.on('randailive:issue',handleIssue)
    return()=>{
      game.events.off('randailive:agent',handleAgent)
      game.events.off('randailive:issue',handleIssue)
      game.destroy(true)
      gameRef.current=null
    }
  },[])

  useEffect(()=>{
    const game=gameRef.current
    if(game)game.registry.set('randRuntime',runtime||[])
  },[runtime])

  useEffect(()=>{
    const game=gameRef.current
    if(game)game.registry.set('randIssues',issues||[])
  },[issues])

  return <div className="rl-game-frame">
    <div ref={hostRef} className="rl-game-canvas" aria-label="RandAILive hotel game world"/>
    <div className="rl-game-tech"><span>PHASER</span><span>GRID ENGINE</span><span>YUKA</span><span>TILED</span></div>
  </div>
}
