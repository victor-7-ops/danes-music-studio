// Shared test-double for `@/lib/supabase/server`'s createClient().
//
// These server actions (src/lib/actions/**) call createClient() internally —
// they are not pure functions with an injectable client, and refactoring
// them to accept one is out of scope for plan 019 (that would be a DI
// refactor, flagged as a follow-up if ever needed). Instead we vi.mock the
// `@/lib/supabase/server` module at the top of each test file and build a
// minimal fluent/thenable query builder here.
//
// Usage in a test file:
//   vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
//   import { createClient } from '@/lib/supabase/server'
//   import { makeMockClient } from './supabaseMock'
//   ...
//   const client = makeMockClient({ bookings: [{ data: {...}, error: null }] })
//   vi.mocked(createClient).mockResolvedValue(client as any)
//
// This is the established pattern for all future server-action tests —
// mirror it rather than reinventing a mock per file.

import { vi } from 'vitest'

export type QueryResult = { data: unknown; error: unknown }

/**
 * A chainable, thenable stand-in for Supabase's PostgrestFilterBuilder.
 * Every filter/modifier method returns the same builder (so any chain
 * length works); `.single()` and `await`-ing the builder directly both
 * resolve to the queued `result`.
 */
function createChainable(result: QueryResult) {
  const builder: Record<string, unknown> = {}
  const chainMethods = [
    'select',
    'eq',
    'neq',
    'gte',
    'lte',
    'gt',
    'lt',
    'in',
    'order',
    'limit',
    'update',
    'insert',
    'delete',
    'upsert',
  ]
  for (const m of chainMethods) {
    builder[m] = vi.fn(() => builder)
  }
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))
  // Makes `await supabase.from(x)...insert(...)` (no .single()) work too.
  builder.then = (
    onFulfilled?: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

/**
 * Builds a mock Supabase client. `tableQueues` maps table name -> ordered
 * list of QueryResults; each `.from(table)` call pops the next queued
 * result for that table (so a test can script multiple sequential calls
 * to the same table).
 */
export function makeMockClient(
  tableQueues: Record<string, QueryResult[]>,
  opts: { user?: { id: string } | null; rpc?: Record<string, QueryResult[]> } = {}
) {
  const queues: Record<string, QueryResult[]> = Object.fromEntries(
    Object.entries(tableQueues).map(([k, v]) => [k, [...v]])
  )
  const rpcQueues: Record<string, QueryResult[]> = Object.fromEntries(
    Object.entries(opts.rpc ?? {}).map(([k, v]) => [k, [...v]])
  )

  const from = vi.fn((table: string) => {
    const queue = queues[table]
    if (!queue || queue.length === 0) {
      throw new Error(
        `[supabaseMock] no queued result for table "${table}" — did the action call .from() more times than expected?`
      )
    }
    const result = queue.shift() as QueryResult
    return createChainable(result)
  })

  const rpc = vi.fn((fn: string) => {
    const queue = rpcQueues[fn]
    if (!queue || queue.length === 0) {
      throw new Error(
        `[supabaseMock] no queued result for rpc "${fn}" — did the action call .rpc() more times than expected?`
      )
    }
    const result = queue.shift() as QueryResult
    return Promise.resolve(result)
  })

  const user = opts.user === undefined ? { id: 'admin-user-1' } : opts.user

  return {
    from,
    rpc,
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user } })),
    },
  }
}
