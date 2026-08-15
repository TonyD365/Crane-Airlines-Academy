'use client'

import { useState } from 'react'

type GroupOption = { id: string; name: string }

/**
 * Inline group assignment for a single student. Any staff member (Trainer and
 * up) may change which group a student belongs to.
 */
export function StudentGroupSelect({
  userId,
  initialGroupId,
  groups,
}: {
  userId: string
  initialGroupId: string | null
  groups: GroupOption[]
}) {
  const [groupId, setGroupId] = useState<string>(initialGroupId ?? '')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  const onChange = async (next: string) => {
    const previous = groupId
    setGroupId(next)
    setPending(true)
    setError(false)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: next === '' ? null : next }),
      })
      if (!res.ok) {
        setGroupId(previous)
        setError(true)
      }
    } catch {
      setGroupId(previous)
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <select
      className={`h-9 rounded-md border px-2 text-sm text-foreground ${
        error ? 'border-destructive' : 'border-input'
      } bg-background`}
      value={groupId}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Student group"
    >
      <option value="">No group</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
    </select>
  )
}
