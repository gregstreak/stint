import { useState, useEffect, useRef, useCallback } from 'react'
import TimerWorker from './timer.worker.js?worker'

const MODES = {
  work:  { label: 'Focus',       default: 25, color: '#C8A97E' },
  short: { label: 'Short Break', default: 5,  color: '#7EB5A6' },
  long:  { label: 'Long Break',  default: 20, color: '#8FA8C8' },
}

const SESSIONS_BEFORE_LONG = 4

function pad(n) { return String(n).padStart(2, '0') }

function beep(ctx, freq = 520, dur = 0.18, vol = 0.4) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.value = freq
  osc.type = 'sine'
  gain.gain.setValueAtTime(vol, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + dur)
}

function chime(ctx) {
  if (!ctx) return
  beep(ctx, 660, 0.2, 0.35)
  setTimeout(() => beep(ctx, 880, 0.2, 0.25), 220)
  setTimeout(() => beep(ctx, 1100, 0.3, 0.2), 420)
}

function notify(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, silent: true })
  }
}

export default function App() {
  const [mode, setMode]         = useState('work')
  const [settings, setSettings] = useState({ work: 25, short: 5, long: 20 })
  const [seconds, setSeconds]   = useState(25 * 60)
  const [running, setRunning]   = useState(false)
  const [sessions, setSessions] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [tempSettings, setTempSettings] = useState({ work: 25, short: 5, long: 20 })
  const [justFinished, setJustFinished] = useState(false)
  const [notifGranted, setNotifGranted] = useState(false)

  const workerRef   = useRef(null)
  const audioCtxRef = useRef(null)
  const modeRef     = useRef(mode)
  const settingsRef = useRef(settings)
  const sessionsRef = useRef(sessions)

  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { sessionsRef.current = sessions }, [sessions])

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    return audioCtxRef.current
  }, [])

  // Request notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => setNotifGranted(p === 'granted'))
    } else if (Notification.permission === 'granted') {
      setNotifGranted(true)
    }
  }, [])

  // Spawn Web Worker
  useEffect(() => {
    workerRef.current = new TimerWorker()
    workerRef.current.onmessage = () => {
      setSeconds(s => {
        if (s <= 1) {
          workerRef.current.postMessage({ type: 'STOP' })
          setRunning(false)
          setJustFinished(true)
          chime(audioCtxRef.current)

          const currentMode = modeRef.current
          const currentSessions = sessionsRef.current
          const currentSettings = settingsRef.current

          if (currentMode === 'work') {
            const next = currentSessions + 1
            setSessions(next)
            const nextMode = next % SESSIONS_BEFORE_LONG === 0 ? 'long' : 'short'
            const label = nextMode === 'long' ? 'Long break time.' : 'Short break time.'
            notify('Stint', label)
            setTimeout(() => {
              setMode(nextMode)
              setSeconds(currentSettings[nextMode] * 60)
              setJustFinished(false)
            }, 1200)
          } else {
            notify('Stint', 'Back to work.')
            setTimeout(() => {
              setMode('work')
              setSeconds(currentSettings.work * 60)
              setJustFinished(false)
            }, 1200)
          }
          return 0
        }
        return s - 1
      })
    }
    return () => workerRef.current.terminate()
  }, [])

  // Update page title with time
  useEffect(() => {
    const m = pad(Math.floor(seconds / 60))
    const s = pad(seconds % 60)
    document.title = running ? `${m}:${s} — Stint` : 'Stint — Do one thing.'
  }, [seconds, running])

  const handleStartPause = () => {
    getAudioCtx()
    if (justFinished) return
    if (running) {
      workerRef.current.postMessage({ type: 'STOP' })
      setRunning(false)
    } else {
      workerRef.current.postMessage({ type: 'START' })
      setRunning(true)
    }
  }

  const handleReset = () => {
    workerRef.current.postMessage({ type: 'STOP' })
    setRunning(false)
    setJustFinished(false)
    setSeconds(settings[mode] * 60)
  }

  const switchMode = (newMode) => {
    workerRef.current.postMessage({ type: 'STOP' })
    setRunning(false)
    setJustFinished(false)
    setMode(newMode)
    setSeconds(settings[newMode] * 60)
  }

  const saveSettings = () => {
    const s = {
      work:  Math.max(1, Math.min(90, tempSettings.work)),
      short: Math.max(1, Math.min(30, tempSettings.short)),
      long:  Math.max(1, Math.min(60, tempSettings.long)),
    }
    setSettings(s)
    settingsRef.current = s
    workerRef.current.postMessage({ type: 'STOP' })
    setRunning(false)
    setSeconds(s[mode] * 60)
    setShowSettings(false)
  }

  const total    = settings[mode] * 60
  const progress = 1 - seconds / total
  const accent   = MODES[mode].color
  const mins     = Math.floor(seconds / 60)
  const secs     = seconds % 60

  const R = 130
  const C = 2 * Math.PI * R
  const dash = progress * C

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0E0E0E',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      color: '#E8E4DC',
      padding: '24px',
      userSelect: 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        width: 420,
        height: 420,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}16 0%, transparent 70%)`,
        transition: 'background 1.4s ease',
        pointerEvents: 'none',
      }} />

      {/* Wordmark */}
      <div style={{
        position: 'absolute',
        top: 28,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}>
        <div style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 15,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: accent,
          transition: 'color 1s ease',
        }}>
          stint
        </div>
        <div style={{
          fontSize: 9,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color: '#333',
        }}>
          Do one thing.
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{
        display: 'flex',
        gap: 3,
        marginBottom: 36,
        background: '#141414',
        borderRadius: 10,
        padding: 4,
        position: 'relative',
        zIndex: 1,
      }}>
        {Object.entries(MODES).map(([key, val]) => (
          <button key={key}
            onClick={() => switchMode(key)}
            style={{
              background: mode === key ? '#1E1E1E' : 'transparent',
              color: mode === key ? accent : '#3A3A3A',
              border: 'none',
              padding: '7px 16px',
              borderRadius: 7,
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
            }}
          >
            {val.label}
          </button>
        ))}
      </div>

      {/* Ring + timer */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <svg width={310} height={310} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
          <circle cx={155} cy={155} r={R} fill="none" stroke="#1C1C1C" strokeWidth={3} />
          <circle
            cx={155} cy={155} r={R}
            fill="none"
            stroke={accent}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
            style={{ transition: 'stroke-dasharray 0.6s linear, stroke 1s ease' }}
          />
        </svg>

        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 70,
            fontWeight: 300,
            letterSpacing: '0.02em',
            color: justFinished ? accent : '#E8E4DC',
            transition: 'color 0.5s ease',
            lineHeight: 1,
          }}>
            {pad(mins)}
            <span style={{
              opacity: running ? 1 : 0.25,
              transition: 'opacity 0.4s',
            }}>:</span>
            {pad(secs)}
          </div>

          {/* Session dots */}
          <div style={{ display: 'flex', gap: 7, justifyContent: 'center', marginTop: 20 }}>
            {Array.from({ length: SESSIONS_BEFORE_LONG }).map((_, i) => {
              const filled = i < (sessions % SESSIONS_BEFORE_LONG)
              return (
                <div key={i} style={{
                  width: 5, height: 5,
                  borderRadius: '50%',
                  background: filled ? accent : '#222',
                  transition: 'background 0.5s ease',
                }} />
              )
            })}
          </div>

          <div style={{
            fontSize: 10,
            color: '#363636',
            letterSpacing: '0.14em',
            marginTop: 10,
            textTransform: 'uppercase',
          }}>
            {sessions === 0 ? 'Ready' : `${sessions} ${sessions === 1 ? 'session' : 'sessions'} done`}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 14, marginTop: 36, position: 'relative', zIndex: 1, alignItems: 'center' }}>
        <button
          onClick={handleReset}
          title="Reset"
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: '#141414',
            border: '1px solid #222',
            color: '#444',
            cursor: 'pointer',
            fontSize: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3A3A3A'; e.currentTarget.style.color = '#777' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#444' }}
        >↺</button>

        <button
          onClick={handleStartPause}
          title={running ? 'Pause' : 'Start'}
          style={{
            width: 68, height: 68, borderRadius: '50%',
            background: running ? 'transparent' : accent,
            border: running ? `1.5px solid ${accent}` : 'none',
            color: running ? accent : '#0E0E0E',
            cursor: 'pointer',
            fontSize: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.25s ease',
            fontWeight: 700,
            boxShadow: running ? 'none' : `0 0 32px ${accent}3A`,
          }}
          onMouseEnter={e => { if (!running) e.currentTarget.style.transform = 'scale(1.06)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          {running ? '⏸' : '▶'}
        </button>

        <button
          onClick={() => { setTempSettings({ ...settings }); setShowSettings(true) }}
          title="Settings"
          style={{
            width: 44, height: 44, borderRadius: '50%',
            background: '#141414',
            border: '1px solid #222',
            color: '#444',
            cursor: 'pointer',
            fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#3A3A3A'; e.currentTarget.style.color = '#777' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#444' }}
        >⚙</button>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#111',
              border: '1px solid #1E1E1E',
              borderRadius: 18,
              padding: '32px 28px',
              width: 300,
            }}
          >
            <div style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 20,
              marginBottom: 30,
              color: '#E8E4DC',
            }}>
              Settings
            </div>

            {[
              { key: 'work',  label: 'Focus',       min: 1, max: 90 },
              { key: 'short', label: 'Short break',  min: 1, max: 30 },
              { key: 'long',  label: 'Long break',   min: 1, max: 60 },
            ].map(({ key, label, min, max }) => (
              <div key={key} style={{ marginBottom: 22 }}>
                <div style={{
                  fontSize: 10, letterSpacing: '0.14em',
                  textTransform: 'uppercase', color: '#444', marginBottom: 10,
                }}>
                  {label}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button
                    onClick={() => setTempSettings(s => ({ ...s, [key]: Math.max(min, s[key] - 1) }))}
                    style={{
                      background: '#1A1A1A', border: '1px solid #2A2A2A',
                      color: '#666', width: 30, height: 30,
                      borderRadius: 8, cursor: 'pointer', fontSize: 18,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >−</button>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 26, color: MODES[key].color,
                    width: 44, textAlign: 'center',
                  }}>
                    {tempSettings[key]}
                  </div>
                  <button
                    onClick={() => setTempSettings(s => ({ ...s, [key]: Math.min(max, s[key] + 1) }))}
                    style={{
                      background: '#1A1A1A', border: '1px solid #2A2A2A',
                      color: '#666', width: 30, height: 30,
                      borderRadius: 8, cursor: 'pointer', fontSize: 18,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >+</button>
                  <span style={{ fontSize: 10, color: '#333', letterSpacing: '0.1em' }}>min</span>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 30 }}>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  flex: 1, padding: '11px',
                  background: 'transparent',
                  border: '1px solid #222', borderRadius: 10,
                  color: '#444', cursor: 'pointer',
                  fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >Cancel</button>
              <button
                onClick={saveSettings}
                style={{
                  flex: 1, padding: '11px',
                  background: accent, border: 'none', borderRadius: 10,
                  color: '#0E0E0E', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'opacity 0.2s',
                }}
              >Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
