import { useEffect, useRef, useState } from 'react'
import { RandMelonHotel } from './MelonHotelGame.js'

export default function RandAILiveGame({runtime,issues,selectedAgent,onAgentSelect,onIssueSelect}){
  const hostRef=useRef(null)
  const engineRef=useRef(null)
  const issuesRef=useRef(issues)
  const [ready,setReady]=useState(false)
  const [error,setError]=useState('')

  useEffect(()=>{issuesRef.current=issues},[issues])

  useEffect(()=>{
    if(!hostRef.current)return undefined
    let disposed=false
    const engine=new RandMelonHotel(hostRef.current,{
      onAgent:(id)=>onAgentSelect?.(id),
      onIssue:(id)=>{
        const issue=issuesRef.current.find((item)=>String(item.id)===String(id))
        if(issue)onIssueSelect?.(issue)
      },
    })
    engineRef.current=engine
    engine.init().then(()=>{
      if(disposed)return
      setReady(true)
      engine.setRuntime(runtime||[])
      engine.setIssues(issues||[])
      engine.setFollow(selectedAgent||null)
    }).catch((e)=>{
      if(!disposed)setError(e?.message||'Impossibile avviare RandAILive')
    })
    return()=>{
      disposed=true
      engine.destroy()
      engineRef.current=null
    }
  },[])

  useEffect(()=>{engineRef.current?.setRuntime(runtime||[])},[runtime])
  useEffect(()=>{engineRef.current?.setIssues(issues||[])},[issues])
  useEffect(()=>{engineRef.current?.setFollow(selectedAgent||null)},[selectedAgent])

  return <div className="rl-game-frame">
    <div ref={hostRef} className="rl-game-canvas" aria-label="RandAILive hotel game world"/>
    {!ready&&!error&&<div className="rl-game-overlay">Carico la hall…</div>}
    {error&&<div className="rl-game-overlay rl-game-overlay--error">{error}</div>}
    <div className="rl-game-tip">{selectedAgent?('Seguo '+selectedAgent):'Tocca un Rand per seguirlo'}</div>
  </div>
}
