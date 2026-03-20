"use client"

import { useCallback, useEffect, useState } from "react"

export type InlineToastType = "success" | "error" | "info"

export interface InlineToastState {
  message: string
  type: InlineToastType
}

export function useInlineToast(timeoutMs = 1700) {
  const [toast, setToast] = useState<InlineToastState | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), timeoutMs)
    return () => clearTimeout(t)
  }, [toast, timeoutMs])

  const showToast = useCallback((message: string, type: InlineToastType = "success") => {
    setToast({ message, type })
  }, [])

  const clearToast = useCallback(() => setToast(null), [])

  return { toast, showToast, clearToast }
}
