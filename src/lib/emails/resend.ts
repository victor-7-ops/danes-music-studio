// src/lib/emails/resend.ts
// Resend client singleton (D-04). Server-only — never import from client components.
// Throws at module load if RESEND_API_KEY is missing (fail-fast misconfiguration guard).

import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
if (!apiKey) {
  throw new Error('RESEND_API_KEY is not set')
}

export const resend = new Resend(apiKey)
