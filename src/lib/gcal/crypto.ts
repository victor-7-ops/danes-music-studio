import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const KEY = Buffer.from(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY!, 'hex')
if (KEY.length !== 32) {
  throw new Error('[gcal:crypto] GOOGLE_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns `iv_hex:authTag_hex:ciphertext_hex`.
 */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':')
}

/**
 * Decrypts a string produced by encryptToken.
 * Throws if the auth tag verification fails (automatic with GCM).
 */
export function decryptToken(stored: string): string {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
