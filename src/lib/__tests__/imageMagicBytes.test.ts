import { describe, it, expect } from 'vitest'
import { isValidImageMagicBytes } from '../imageMagicBytes'

describe('isValidImageMagicBytes', () => {
  it('accepts real JPEG magic bytes', () => {
    expect(isValidImageMagicBytes('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(true)
  })

  it('accepts real PNG magic bytes', () => {
    expect(isValidImageMagicBytes('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(true)
  })

  it('rejects a text file renamed to .jpg (spoofed mime, wrong bytes)', () => {
    const fakeJpeg = new TextEncoder().encode('not an image')
    expect(isValidImageMagicBytes('image/jpeg', fakeJpeg)).toBe(false)
  })

  it('rejects PNG bytes claiming to be JPEG', () => {
    expect(isValidImageMagicBytes('image/jpeg', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false)
  })

  it('rejects buffers shorter than 4 bytes', () => {
    expect(isValidImageMagicBytes('image/jpeg', new Uint8Array([0xff, 0xd8]))).toBe(false)
  })

  it('rejects unsupported mime types outright', () => {
    expect(isValidImageMagicBytes('application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(false)
  })

  it('accepts real WEBP magic bytes (RIFF....WEBP)', () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
    expect(isValidImageMagicBytes('image/webp', bytes)).toBe(true)
  })
})
