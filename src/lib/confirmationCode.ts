import { randomUUID } from 'node:crypto'

// 128 random bits leave these display references distinct from the UUID
// cancel_token capability used to authorize customer actions.
export function createConfirmationCode(): string {
  return `DMS-${randomUUID().replace(/-/g, '').toUpperCase()}`
}
