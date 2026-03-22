export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export function generateLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}
