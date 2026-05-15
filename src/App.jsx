import { useState, useEffect, useRef, useCallback } from 'react'

const MODES = {
  work:  { label: 'Focus',       default: 25, color: '#A8C4E0' },
  short: { label: 'Short Break', default: 5,  color: '#7EB5A6' },
  long:  { label: 'Long Break',  default: 20, color: '#A8C4E0' },
}

const BG       = '#0D1B2A'
const SURFACE  = '#0F2033'
const SURFACE2 = '#122540'
const TRACK    = '#1A2D42'
const TEXT     = '#D8E8F4'
const MUTED    = '#2A4060'

const SESSIONS_BEFORE_LONG = 4

function pad(n) { return String(n).padStart(2, '0') }

function beep(ctx, freq, dur, vol) {
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq || 520
    osc.type = 'sine'
    gain.gain.setValueAtTime(vol || 0.7, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.3))
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + (dur || 0.3))
  } catch (e) {}
}

function chime(ctx) {
  if (!ctx) return
  // Three-tone alarm, repeated 5 times with gap between sets
  const REPS = 5
  const GAP  = 1100 // ms between repetitions
  for (let i = 0; i < REPS; i++) {
    const base = i * GAP
    setTimeout(() => beep(ctx, 880, 0.35, 0.9), base)
    setTimeout(() => beep(ctx, 660, 0.35, 0.85), base + 380)
    setTimeout(() => beep(ctx, 550, 0.5,  0.8), base + 700)
  }
}

function notify(title, body) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      // silent: false so the system plays the default notification sound
      new Notification(title, { body, silent: false, requireInteraction: false })
    }
  } catch (e) {}
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
  const [alert, setAlert]               = useState(null) // { message, color }

  const intervalRef  = useRef(null)
  const audioCtxRef  = useRef(null)
  const modeRef      = useRef(mode)
  const settingsRef  = useRef(settings)
  const sessionsRef  = useRef(sessions)
  const runningRef   = useRef(false)
  const secondsRef   = useRef(25 * 60)
  const startTimeRef  = useRef(null)
  const startSecsRef  = useRef(null)
  const titleFlashRef = useRef(null)

  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { sessionsRef.current = sessions }, [sessions])
  useEffect(() => { secondsRef.current = seconds }, [seconds])

  const getAudioCtx = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {})
      }
    } catch (e) {}
    return audioCtxRef.current
  }, [])

  const triggerAlarm = useCallback((message, color) => {
    // Resume audio context and play chime
    try {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().then(() => chime(audioCtxRef.current)).catch(() => {})
      } else {
        chime(audioCtxRef.current)
      }
    } catch (e) {}
    // Show visual alert banner
    setAlert({ message, color })
    setTimeout(() => setAlert(null), 4000)
    // Flash tab title 8 times
    clearInterval(titleFlashRef.current)
    let flashes = 0
    const flashMsg = `⏰ ${message}`
    const original = document.title
    titleFlashRef.current = setInterval(() => {
      document.title = flashes % 2 === 0 ? flashMsg : original
      flashes++
      if (flashes >= 16) {
        clearInterval(titleFlashRef.current)
        document.title = original
      }
    }, 600)
  }, [])

  useEffect(() => {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    } catch (e) {}
  }, [])

  const handleFinish = useCallback(() => {
    clearInterval(intervalRef.current)
    runningRef.current = false
    setRunning(false)
    setJustFinished(true)

    const currentMode     = modeRef.current
    const currentSessions = sessionsRef.current
    const currentSettings = settingsRef.current

    if (currentMode === 'work') {
      const next = currentSessions + 1
      setSessions(next)
      const nextMode = next % SESSIONS_BEFORE_LONG === 0 ? 'long' : 'short'
      const msg = nextMode === 'long' ? 'Long break — step away.' : 'Short break — rest up.'
      triggerAlarm(msg, '#7EB5A6')
      notify('Stint', msg)
      setTimeout(() => {
        const ns = currentSettings[nextMode] * 60
        setMode(nextMode)
        modeRef.current = nextMode
        setSeconds(ns)
        secondsRef.current = ns
        setJustFinished(false)
        runningRef.current = true
        setRunning(true)
        startTimeRef.current = Date.now()
        startSecsRef.current = ns
        clearInterval(intervalRef.current)
        intervalRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
          const remaining = startSecsRef.current - elapsed
          if (remaining <= 0) { setSeconds(0); secondsRef.current = 0; handleFinish() }
          else { setSeconds(remaining); secondsRef.current = remaining }
        }, 500)
      }, 1500)
    } else {
      triggerAlarm('Back to work.', '#A8C4E0')
      notify('Stint', 'Back to work.')
      setTimeout(() => {
        const ns = currentSettings.work * 60
        setMode('work')
        modeRef.current = 'work'
        setSeconds(ns)
        secondsRef.current = ns
        setJustFinished(false)
        runningRef.current = true
        setRunning(true)
        startTimeRef.current = Date.now()
        startSecsRef.current = ns
        clearInterval(intervalRef.current)
        intervalRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
          const remaining = startSecsRef.current - elapsed
          if (remaining <= 0) { setSeconds(0); secondsRef.current = 0; handleFinish() }
          else { setSeconds(remaining); secondsRef.current = remaining }
        }, 500)
      }, 1500)
    }
  }, [triggerAlarm])

  const startTimer = useCallback(() => {
    clearInterval(intervalRef.current)
    startTimeRef.current = Date.now()
    startSecsRef.current = secondsRef.current
    intervalRef.current = setInterval(() => {
      const elapsed   = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const remaining = startSecsRef.current - elapsed
      if (remaining <= 0) {
        setSeconds(0)
        secondsRef.current = 0
        handleFinish()
      } else {
        setSeconds(remaining)
        secondsRef.current = remaining
      }
    }, 500)
  }, [handleFinish])

  useEffect(() => {
    const onVisible = () => {
      if (runningRef.current && startTimeRef.current) {
        const elapsed   = Math.floor((Date.now() - startTimeRef.current) / 1000)
        const remaining = startSecsRef.current - elapsed
        if (remaining <= 0) {
          handleFinish()
        } else {
          setSeconds(remaining)
          secondsRef.current = remaining
        }
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [handleFinish])

  useEffect(() => {
    const m = pad(Math.floor(seconds / 60))
    const s = pad(seconds % 60)
    document.title = running ? `${m}:${s} — Stint` : 'Stint — Do one thing.'
  }, [seconds, running])

  useEffect(() => { return () => clearInterval(intervalRef.current) }, [])

  const handleStartPause = () => {
    getAudioCtx()
    if (justFinished) return
    if (running) {
      clearInterval(intervalRef.current)
      runningRef.current = false
      setRunning(false)
    } else {
      runningRef.current = true
      setRunning(true)
      startTimer()
    }
  }

  const handleReset = () => {
    clearInterval(intervalRef.current)
    runningRef.current = false
    setRunning(false)
    setJustFinished(false)
    const ns = settings[mode] * 60
    setSeconds(ns)
    secondsRef.current = ns
  }

  const switchMode = (newMode) => {
    clearInterval(intervalRef.current)
    runningRef.current = false
    setRunning(false)
    setJustFinished(false)
    setMode(newMode)
    const ns = settings[newMode] * 60
    setSeconds(ns)
    secondsRef.current = ns
  }

  const saveSettings = () => {
    const s = {
      work:  Math.max(1, Math.min(90, tempSettings.work)),
      short: Math.max(1, Math.min(30, tempSettings.short)),
      long:  Math.max(1, Math.min(60, tempSettings.long)),
    }
    setSettings(s)
    settingsRef.current = s
    clearInterval(intervalRef.current)
    runningRef.current = false
    setRunning(false)
    const ns = s[mode] * 60
    setSeconds(ns)
    secondsRef.current = ns
    setShowSettings(false)
  }

  const total    = settings[mode] * 60
  const progress = 1 - seconds / total
  const accent   = MODES[mode].color
  const mins     = Math.floor(seconds / 60)
  const secs     = seconds % 60
  const R        = 130
  const C        = 2 * Math.PI * R
  const dash     = progress * C
  const btn      = { WebkitAppearance: 'none', cursor: 'pointer' }

  return (
    <div style={{
      minHeight: '100svh',
      background: BG,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      color: TEXT,
      padding: '24px',
      userSelect: 'none', WebkitUserSelect: 'none',
      position: 'relative', overflow: 'hidden',
    }}>

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', width: 420, height: 420, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}12 0%, transparent 70%)`,
        transition: 'background 1.4s ease', pointerEvents: 'none',
      }} />

      {/* Wordmark */}
      <div style={{
        position: 'absolute', top: 24, left: 0, right: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        <svg width="26" height="26" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="32" fill="none" stroke={TRACK} strokeWidth="5"/>
          <path d="M48,16 A32,32 0 1,1 22.48,27.52" fill="none" stroke={accent}
            strokeWidth="5" strokeLinecap="round" style={{ transition: 'stroke 1s ease' }}/>
          <circle cx="22.48" cy="27.52" r="4" fill={accent} opacity="0.6"
            style={{ transition: 'fill 1s ease' }}/>
        </svg>
        <div style={{
          fontFamily: "'DM Serif Display', serif", fontSize: 14,
          letterSpacing: '0.28em', textTransform: 'uppercase',
          color: accent, transition: 'color 1s ease',
        }}>stint</div>
        <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTED }}>
          Do one thing.
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{
        display: 'flex', gap: 3, marginBottom: 36,
        background: SURFACE, borderRadius: 10, padding: 4,
        position: 'relative', zIndex: 1,
      }}>
        {Object.entries(MODES).map(([key, val]) => (
          <button key={key} onClick={() => switchMode(key)} style={{
            ...btn,
            background: mode === key ? SURFACE2 : 'transparent',
            color: mode === key ? accent : MUTED,
            border: 'none', padding: '7px 16px', borderRadius: 7,
            fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
            transition: 'all 0.25s ease', fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
          }}>{val.label}</button>
        ))}
      </div>

      {/* Ring + timer */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <svg width={310} height={310} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
          <circle cx={155} cy={155} r={R} fill="none" stroke={TRACK} strokeWidth={3} />
          <circle cx={155} cy={155} r={R} fill="none" stroke={accent} strokeWidth={2.5}
            strokeLinecap="round" strokeDasharray={`${dash} ${C}`}
            style={{ transition: 'stroke-dasharray 0.6s linear, stroke 1s ease' }} />
        </svg>

        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', textAlign: 'center',
        }}>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: 70, fontWeight: 300,
            letterSpacing: '0.02em', lineHeight: 1,
            color: justFinished ? accent : TEXT, transition: 'color 0.5s ease',
          }}>
            {pad(mins)}
            <span style={{ opacity: running ? 1 : 0.2, transition: 'opacity 0.4s' }}>:</span>
            {pad(secs)}
          </div>

          <div style={{ display: 'flex', gap: 7, justifyContent: 'center', marginTop: 20 }}>
            {Array.from({ length: SESSIONS_BEFORE_LONG }).map((_, i) => (
              <div key={i} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: i < (sessions % SESSIONS_BEFORE_LONG) ? accent : TRACK,
                transition: 'background 0.5s ease',
              }} />
            ))}
          </div>

          <div style={{
            fontSize: 10, color: MUTED, letterSpacing: '0.14em',
            marginTop: 10, textTransform: 'uppercase',
          }}>
            {sessions === 0 ? 'Ready' : `${sessions} ${sessions === 1 ? 'session' : 'sessions'} done`}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 14, marginTop: 36, position: 'relative', zIndex: 1, alignItems: 'center' }}>
        <button onClick={handleReset} style={{
          ...btn, width: 44, height: 44, borderRadius: '50%',
          background: '#122540', border: '1px solid #2A4A6A', color: '#6A9ABB', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}>↺</button>

        <button onClick={handleStartPause} style={{
          ...btn, width: 68, height: 68, borderRadius: '50%',
          background: running ? 'transparent' : '#C8DDF0',
          border: running ? `1.5px solid #C8DDF0` : 'none',
          color: running ? '#C8DDF0' : BG, fontSize: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, boxShadow: running ? 'none' : '0 0 32px #A8C4E050',
          transition: 'all 0.25s ease',
        }}>{running ? '⏸' : '▶'}</button>

        <button onClick={() => { setTempSettings({ ...settings }); setShowSettings(true) }} style={{
          ...btn, width: 44, height: 44, borderRadius: '50%',
          background: '#122540', border: '1px solid #2A4A6A', color: '#6A9ABB', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}>⚙</button>
      </div>

      {/* Alert banner */}
      {alert && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0,
          background: alert.color,
          color: BG,
          padding: '16px 24px',
          textAlign: 'center',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          zIndex: 200,
          animation: 'slideDown 0.3s ease',
        }}>
          {alert.message}
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div onClick={() => setShowSettings(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(5,12,22,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: SURFACE, border: `1px solid ${TRACK}`,
            borderRadius: 18, padding: '32px 28px', width: 300,
          }}>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, marginBottom: 30, color: TEXT }}>
              Settings
            </div>
            {[
              { key: 'work',  label: 'Focus',      min: 1, max: 90 },
              { key: 'short', label: 'Short break', min: 1, max: 30 },
              { key: 'long',  label: 'Long break',  min: 1, max: 60 },
            ].map(({ key, label, min, max }) => (
              <div key={key} style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, marginBottom: 10 }}>{label}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <button onClick={() => setTempSettings(s => ({ ...s, [key]: Math.max(min, s[key] - 1) }))}
                    style={{ ...btn, background: SURFACE2, border: `1px solid ${TRACK}`, color: TEXT, width: 30, height: 30, borderRadius: 8, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 26, color: MODES[key].color, width: 44, textAlign: 'center' }}>{tempSettings[key]}</div>
                  <button onClick={() => setTempSettings(s => ({ ...s, [key]: Math.min(max, s[key] + 1) }))}
                    style={{ ...btn, background: SURFACE2, border: `1px solid ${TRACK}`, color: TEXT, width: 30, height: 30, borderRadius: 8, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  <span style={{ fontSize: 10, color: MUTED, letterSpacing: '0.1em' }}>min</span>
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 30 }}>
              <button onClick={() => setShowSettings(false)} style={{ ...btn, flex: 1, padding: '11px', background: 'transparent', border: `1px solid ${TRACK}`, borderRadius: 10, color: MUTED, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
              <button onClick={saveSettings} style={{ ...btn, flex: 1, padding: '11px', background: accent, border: 'none', borderRadius: 10, color: BG, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
