import crypto from "node:crypto"

export function newId() {
  return crypto.randomUUID()
}

export function newSessionToken() {
  // raw token goes to cookie
  return crypto.randomBytes(32).toString("base64url")
}

export function sha256Base64(input: string) {
  return crypto.createHash("sha256").update(input).digest("base64")
}

