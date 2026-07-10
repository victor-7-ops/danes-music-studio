// Maps URL-safe service slugs to service_types.name rows.
// Slugs live in URLs; names live in the DB. Keep in sync with seed migrations.
export const SERVICES = {
  rehearsal: { name: 'Rehearsal', label: 'Rehearsal' },
  recording: { name: 'Regular Tracking', label: 'Recording' },
} as const

export type ServiceSlug = keyof typeof SERVICES

export function isServiceSlug(s: string): s is ServiceSlug {
  return s in SERVICES
}
