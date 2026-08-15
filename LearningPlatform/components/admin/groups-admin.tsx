'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trash2, Pencil, Check, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminGlassCard, adminGlassOutlineButton } from '@/lib/student-glass-styles'

type Group = {
  id: string
  name: string
  memberCount: number
}

type UserRow = {
  id: string
  username: string | null
  name: string | null
  role: string
  groupId: string | null
  group: { id: string; name: string } | null
}

const inputClass =
  'h-10 border border-input bg-background text-sm text-foreground shadow-xs dark:bg-background'
const selectClass =
  'h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground'

export function GroupsAdmin() {
  const [groups, setGroups] = useState<Group[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [gRes, uRes] = await Promise.all([
        fetch('/api/admin/groups'),
        fetch('/api/admin/users?page=1&limit=100'),
      ])
      const gData = (await gRes.json().catch(() => ({}))) as { groups?: Group[]; error?: string }
      const uData = (await uRes.json().catch(() => ({}))) as { users?: UserRow[]; error?: string }
      if (!gRes.ok) {
        setError(gData.error ?? 'Failed to load groups')
        return
      }
      setGroups(gData.groups ?? [])
      setUsers(uData.users ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(t)
  }, [load])

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Failed to create group')
        return
      }
      setNewName('')
      await load()
    } catch {
      setError('Network error')
    } finally {
      setCreating(false)
    }
  }

  const renameGroup = async (id: string) => {
    const name = editingName.trim()
    if (!name) return
    setPendingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/groups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Failed to rename group')
        return
      }
      setEditingId(null)
      setEditingName('')
      await load()
    } catch {
      setError('Network error')
    } finally {
      setPendingId(null)
    }
  }

  const deleteGroup = async (id: string, name: string) => {
    if (!confirm(`Delete group "${name}"? Students in it will be left without a group.`)) return
    setPendingId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/groups/${id}`, { method: 'DELETE' })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Failed to delete group')
        return
      }
      await load()
    } catch {
      setError('Network error')
    } finally {
      setPendingId(null)
    }
  }

  const assignGroup = async (userId: string, groupId: string) => {
    setPendingId(userId)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: groupId === '' ? null : groupId }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Failed to update student group')
        return
      }
      const nextGroup = groups.find((g) => g.id === groupId) ?? null
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, groupId: groupId === '' ? null : groupId, group: nextGroup ? { id: nextGroup.id, name: nextGroup.name } : null }
            : u,
        ),
      )
      // Refresh member counts.
      void load()
    } catch {
      setError('Network error')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {/* Create group */}
      <div className={cn('rounded-xl border-0 p-4 shadow-none md:p-6', adminGlassCard)}>
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Groups</h2>
        <form onSubmit={createGroup} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New group name (e.g. Class A)"
            className={cn('sm:max-w-xs', inputClass)}
            maxLength={80}
          />
          <Button type="submit" variant="hero" className="auth-hero-cta" disabled={creating || !newName.trim()}>
            <Plus className="mr-2 h-4 w-4" />
            {creating ? 'Creating…' : 'Add group'}
          </Button>
        </form>

        <div className="overflow-hidden rounded-lg border border-slate-200/60 dark:border-white/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-28 text-center">Students</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No groups yet. Create one above.
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>
                      {editingId === g.id ? (
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className={cn('h-9 max-w-xs', inputClass)}
                          maxLength={80}
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium text-gray-900 dark:text-gray-100">{g.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{g.memberCount}</TableCell>
                    <TableCell className="text-right">
                      {editingId === g.id ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className={cn('h-8 w-8', adminGlassOutlineButton)}
                            disabled={pendingId === g.id}
                            onClick={() => renameGroup(g.id)}
                            aria-label="Save name"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className={cn('h-8 w-8', adminGlassOutlineButton)}
                            onClick={() => {
                              setEditingId(null)
                              setEditingName('')
                            }}
                            aria-label="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className={cn('h-8 w-8', adminGlassOutlineButton)}
                            onClick={() => {
                              setEditingId(g.id)
                              setEditingName(g.name)
                            }}
                            aria-label="Rename group"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 border-red-300/50 text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-300 dark:hover:bg-red-950/30"
                            disabled={pendingId === g.id}
                            onClick={() => deleteGroup(g.id, g.name)}
                            aria-label="Delete group"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Assign students */}
      <div className={cn('rounded-xl border-0 p-4 shadow-none md:p-6', adminGlassCard)}>
        <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-gray-100">Assign students</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Set which group each student belongs to. Showing the first 100 accounts.
        </p>
        <div className="overflow-hidden rounded-lg border border-slate-200/60 dark:border-white/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-56">Group</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium text-gray-900 dark:text-gray-100">
                      {u.username ?? '—'}
                    </TableCell>
                    <TableCell>{u.name ?? '—'}</TableCell>
                    <TableCell>{u.role}</TableCell>
                    <TableCell>
                      <select
                        className={selectClass}
                        value={u.groupId ?? ''}
                        disabled={pendingId === u.id}
                        onChange={(e) => assignGroup(u.id, e.target.value)}
                      >
                        <option value="">No group</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
