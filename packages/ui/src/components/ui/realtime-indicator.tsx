"use client"

import { useState, useEffect } from 'react'

export function RealtimeIndicator() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const checkConnection = () => {
      setConnected(navigator.onLine)
    }
    checkConnection()
    window.addEventListener('online', checkConnection)
    window.addEventListener('offline', checkConnection)
    return () => {
      window.removeEventListener('online', checkConnection)
      window.removeEventListener('offline', checkConnection)
    }
  }, [])

  return (
    <span className={`sync-pill ${connected ? 'ok' : 'off'}`}>
      {connected ? '● زنده' : '● قطع'}
    </span>
  )
}