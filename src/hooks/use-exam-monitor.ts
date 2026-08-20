"use client"

import { useEffect, useRef, useCallback, useReducer } from "react"

export interface MonitorState {
  tabSwitchCount: number
  blurCount: number
  totalBlurMs: number
  copyAttempts: number
  pasteAttempts: number
  rightClickAttempts: number
  devtoolsAttempts: number
  fullscreenExits: number
  cheatingScore: number
}

export interface MonitorEvent {
  type: string
  severity: string
  message: string
}

type Action =
  | { type: "TAB_SWITCH" }
  | { type: "BLUR"; durationMs: number }
  | { type: "COPY" }
  | { type: "PASTE" }
  | { type: "RIGHT_CLICK" }
  | { type: "DEVTOOLS" }
  | { type: "FULLSCREEN_EXIT" }
  | { type: "RESET" }

const SCORE_MAP: Record<Action["type"], number> = {
  TAB_SWITCH: 15,
  BLUR: 10,
  COPY: 20,
  PASTE: 20,
  RIGHT_CLICK: 5,
  DEVTOOLS: 25,
  FULLSCREEN_EXIT: 15,
  RESET: 0,
}

const initialState: MonitorState = {
  tabSwitchCount: 0,
  blurCount: 0,
  totalBlurMs: 0,
  copyAttempts: 0,
  pasteAttempts: 0,
  rightClickAttempts: 0,
  devtoolsAttempts: 0,
  fullscreenExits: 0,
  cheatingScore: 0,
}

function reducer(state: MonitorState, action: Action): MonitorState {
  const scoreGain = SCORE_MAP[action.type]
  switch (action.type) {
    case "TAB_SWITCH":
      return {
        ...state,
        tabSwitchCount: state.tabSwitchCount + 1,
        cheatingScore: Math.min(100, state.cheatingScore + scoreGain),
      }
    case "BLUR":
      return {
        ...state,
        blurCount: state.blurCount + 1,
        totalBlurMs: state.totalBlurMs + action.durationMs,
        cheatingScore: Math.min(100, state.cheatingScore + scoreGain),
      }
    case "COPY":
      return {
        ...state,
        copyAttempts: state.copyAttempts + 1,
        cheatingScore: Math.min(100, state.cheatingScore + scoreGain),
      }
    case "PASTE":
      return {
        ...state,
        pasteAttempts: state.pasteAttempts + 1,
        cheatingScore: Math.min(100, state.cheatingScore + scoreGain),
      }
    case "RIGHT_CLICK":
      return {
        ...state,
        rightClickAttempts: state.rightClickAttempts + 1,
        cheatingScore: Math.min(100, state.cheatingScore + scoreGain),
      }
    case "DEVTOOLS":
      return {
        ...state,
        devtoolsAttempts: state.devtoolsAttempts + 1,
        cheatingScore: Math.min(100, state.cheatingScore + scoreGain),
      }
    case "FULLSCREEN_EXIT":
      return {
        ...state,
        fullscreenExits: state.fullscreenExits + 1,
        cheatingScore: Math.min(100, state.cheatingScore + scoreGain),
      }
    case "RESET":
      return { ...initialState }
    default:
      return state
  }
}

interface UseExamMonitorOptions {
  sessionId: string | null
  ujianId: string
  isActive: boolean
  onCheatingDetected: (event: MonitorEvent) => void
  onAutoSubmit: () => void
}

export function useExamMonitor(options: UseExamMonitorOptions) {
  const { sessionId, ujianId, isActive, onCheatingDetected, onAutoSubmit } = options
  const [state, dispatch] = useReducer(reducer, initialState)
  const stateRef = useRef(state)
  stateRef.current = state
  const blurStartRef = useRef<number | null>(null)
  const autoSubmitTriggeredRef = useRef(false)

  const reportEvent = useCallback(
    async (type: string, detail?: Record<string, unknown>) => {
      if (!sessionId || !ujianId) return
      try {
        await fetch(`/api/siswa/ujian/${ujianId}/report-cheating`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, detail, clientTimestamp: Date.now() }),
        })
      } catch {
        // silent fail - monitoring should not block exam
      }
    },
    [sessionId, ujianId]
  )

  const checkAutoSubmit = useCallback(
    (score: number, tabCount: number) => {
      if (autoSubmitTriggeredRef.current) return
      if (score >= 75 || tabCount >= 3) {
        autoSubmitTriggeredRef.current = true
        onAutoSubmit()
      }
    },
    [onAutoSubmit]
  )

  useEffect(() => {
    if (!isActive) return

    const handleVisibility = () => {
      if (document.hidden) {
        dispatch({ type: "TAB_SWITCH" })
        const next = stateRef.current
        reportEvent("TAB_SWITCH", { tabSwitchCount: next.tabSwitchCount })
        onCheatingDetected({
          type: "TAB_SWITCH",
          severity: "MEDIUM",
          message: `Tab dipindahkan (${next.tabSwitchCount}x)`,
        })
        checkAutoSubmit(next.cheatingScore, next.tabSwitchCount)
      }
    }

    const handleBlur = () => {
      blurStartRef.current = Date.now()
    }

    const handleFocus = () => {
      if (blurStartRef.current !== null) {
        const durationMs = Date.now() - blurStartRef.current
        blurStartRef.current = null
        if (durationMs > 500) {
          dispatch({ type: "BLUR", durationMs })
          const next = stateRef.current
          reportEvent("WINDOW_BLUR", {
            durationMs,
            totalBlurMs: next.totalBlurMs,
          })
          onCheatingDetected({
            type: "WINDOW_BLUR",
            severity: "LOW",
            message: `Jendela kehilangan fokus (${Math.round(durationMs / 1000)}s)`,
          })
          checkAutoSubmit(next.cheatingScore, next.tabSwitchCount)
        }
      }
    }

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      dispatch({ type: "COPY" })
      const next = stateRef.current
      reportEvent("COPY_ATTEMPT", { copyAttempts: next.copyAttempts })
      onCheatingDetected({
        type: "COPY_ATTEMPT",
        severity: "HIGH",
        message: `Percobaan copy (${next.copyAttempts}x)`,
      })
      checkAutoSubmit(next.cheatingScore, next.tabSwitchCount)
    }

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault()
      dispatch({ type: "PASTE" })
      const next = stateRef.current
      reportEvent("PASTE_ATTEMPT", { pasteAttempts: next.pasteAttempts })
      onCheatingDetected({
        type: "PASTE_ATTEMPT",
        severity: "HIGH",
        message: `Percobaan paste (${next.pasteAttempts}x)`,
      })
      checkAutoSubmit(next.cheatingScore, next.tabSwitchCount)
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      dispatch({ type: "RIGHT_CLICK" })
      const next = stateRef.current
      reportEvent("RIGHT_CLICK", { rightClickAttempts: next.rightClickAttempts })
      onCheatingDetected({
        type: "RIGHT_CLICK",
        severity: "LOW",
        message: `Klik kanan dicegah (${next.rightClickAttempts}x)`,
      })
      checkAutoSubmit(next.cheatingScore, next.tabSwitchCount)
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && e.key === "I") || (e.ctrlKey && e.key === "u")) {
        e.preventDefault()
        dispatch({ type: "DEVTOOLS" })
        const next = stateRef.current
        reportEvent("DEVTOOLS", { devtoolsAttempts: next.devtoolsAttempts })
        onCheatingDetected({
          type: "DEVTOOLS",
          severity: "CRITICAL",
          message: `Akses devtools dicegah (${next.devtoolsAttempts}x)`,
        })
        checkAutoSubmit(next.cheatingScore, next.tabSwitchCount)
      }
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        dispatch({ type: "FULLSCREEN_EXIT" })
        const next = stateRef.current
        reportEvent("FULLSCREEN_EXIT", { fullscreenExits: next.fullscreenExits })
        onCheatingDetected({
          type: "FULLSCREEN_EXIT",
          severity: "MEDIUM",
          message: `Keluar dari fullscreen (${next.fullscreenExits}x)`,
        })
        checkAutoSubmit(next.cheatingScore, next.tabSwitchCount)
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("blur", handleBlur)
    window.addEventListener("focus", handleFocus)
    document.addEventListener("copy", handleCopy)
    document.addEventListener("paste", handlePaste)
    document.addEventListener("contextmenu", handleContextMenu)
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("fullscreenchange", handleFullscreenChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("blur", handleBlur)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("copy", handleCopy)
      document.removeEventListener("paste", handlePaste)
      document.removeEventListener("contextmenu", handleContextMenu)
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [isActive, reportEvent, onCheatingDetected, checkAutoSubmit])

  const reset = useCallback(() => {
    dispatch({ type: "RESET" })
    autoSubmitTriggeredRef.current = false
  }, [])

  return { state, reset }
}
