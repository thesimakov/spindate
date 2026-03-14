import crypto from "node:crypto"

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEYLEN = 64

export function generateSalt() {
  return crypto.randomBytes(16).toString("base64")
}

export async function hashPassword(password: string, saltBase64: string) {
  const salt = Buffer.from(saltBase64, "base64")
  const key = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      KEYLEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, derivedKey) => {
        if (err) reject(err)
        else resolve(derivedKey as Buffer)
      },
    )
  })
  return key.toString("base64")
}

export async function verifyPassword(password: string, saltBase64: string, expectedHashBase64: string) {
  const actual = await hashPassword(password, saltBase64)
  const a = Buffer.from(actual, "base64")
  const b = Buffer.from(expectedHashBase64, "base64")
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

