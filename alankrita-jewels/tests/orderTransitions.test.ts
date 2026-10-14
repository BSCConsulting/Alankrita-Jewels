import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ORDER_TRANSITIONS } from '../src/services/admin'
import { ORDER_STATUSES } from '../src/types'

/** Reads the allowed transitions out of the guard_order_status trigger, so the UI and database cannot drift apart. */
function transitionsFromMigration(): Record<string, string[]> {
  const sql = readFileSync(new URL('../supabase/migrations/002_audit_fixes.sql', import.meta.url), 'utf8')
  const rules: Record<string, string[]> = {}
  for (const m of sql.matchAll(/old\.order_status = '(\w+)'\s+and new\.order_status in \(([^)]+)\)/g)) {
    rules[m[1]] = m[2].split(',').map((s) => s.trim().replace(/'/g, ''))
  }
  return rules
}

describe('ORDER_TRANSITIONS', () => {
  it('matches the database trigger exactly', () => {
    const db = transitionsFromMigration()
    expect(Object.keys(db).length).toBeGreaterThan(0)
    for (const status of ORDER_STATUSES) {
      expect([...ORDER_TRANSITIONS[status]].sort(), status).toEqual([...(db[status] ?? [])].sort())
    }
  })

  it('treats delivered and cancelled orders as final', () => {
    expect(ORDER_TRANSITIONS.DELIVERED).toEqual([])
    expect(ORDER_TRANSITIONS.CANCELLED).toEqual([])
  })
})
