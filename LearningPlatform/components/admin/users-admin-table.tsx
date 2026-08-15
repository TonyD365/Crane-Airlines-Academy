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
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminGlassCard, adminGlassOutlineButton, studentGlassPill } from '@/lib/student-glass-styles'

type UserRow = {
  id: string
  email: string
  username: string | null
  name: string | null
  role: string
  isPro: boolean
  createdAt: string
  groupId: string | null
  group: { id: string; name: string } | null
}

type GroupOption = { id: string; name: string }

const PAGE_SIZE = 20

interface UsersAdminTableProps {
  currentUserId: string | null
}

export function UsersAdminTable({ currentUserId }: UsersAdminTableProps) {
  const [page, setPage] = useState(1)
  const [users, setUsers] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** `${userId}:pro` | `${userId}:role` | `${userId}:group` while a PATCH is in flight */
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [groups, setGroups] = useState<GroupOption[]>([])

  // Create-user form state
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [form, setForm] = useState({
    username: '',
    password: '',
    name: '',
    role: 'STUDENT',
    groupId: '',
  })

  const load = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users?page=${p}&limit=${PAGE_SIZE}`)
      const data = (await res.json().catch(() => ({}))) as {
        users?: UserRow[]
        total?: number
        page?: number
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? 'Failed to load users')
        return
      }
      setUsers(data.users ?? [])
      setTotal(data.total ?? 0)
      if (data.page && data.page !== p) setPage(data.page)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void load(page)
    }, 0)
    return () => window.clearTimeout(t)
  }, [page, load])

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/groups')
      if (!res.ok) return
      const data = (await res.json().catch(() => ({}))) as { groups?: GroupOption[] }
      setGroups((data.groups ?? []).map((g) => ({ id: g.id, name: g.name })))
    } catch {
      // leave groups empty
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadGroups()
    }, 0)
    return () => window.clearTimeout(t)
  }, [loadGroups])

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          password: form.password,
          name: form.name.trim() || undefined,
          role: form.role,
          groupId: form.groupId || null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setCreateError(data.error ?? 'Failed to create user')
        return
      }
      setForm({ username: '', password: '', name: '', role: 'STUDENT', groupId: '' })
      setShowCreate(false)
      setPage(1)
      await load(1)
      await loadGroups()
    } catch {
      setCreateError('Network error')
    } finally {
      setCreating(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const patchUser = async (
    userId: string,
    slot: 'pro' | 'role' | 'group',
    body: Record<string, unknown>,
  ) => {
    setPendingKey(`${userId}:${slot}`)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        isPro?: boolean
        role?: string
        groupId?: string | null
      }
      if (!res.ok) {
        setError(data.error ?? 'Update failed')
        return
      }
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== userId) return u
          const nextGroupId = 'groupId' in data ? data.groupId ?? null : u.groupId
          const nextGroup =
            'groupId' in data
              ? groups.find((g) => g.id === nextGroupId) ?? null
              : u.group
          return {
            ...u,
            ...(typeof data.isPro === 'boolean' ? { isPro: data.isPro } : {}),
            ...(typeof data.role === 'string' ? { role: data.role } : {}),
            ...('groupId' in data ? { groupId: nextGroupId, group: nextGroup } : {}),
          }
        }),
      )
    } catch {
      setError('Network error')
    } finally {
      setPendingKey(null)
    }
  }

  const fieldClass = 'h-9 border border-input bg-background text-sm text-foreground dark:bg-background'
  const selectClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground'

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Accounts are created here — public sign-up is disabled. Users sign in with their RBX username.
        </p>
        <Button
          type="button"
          variant="hero"
          size="sm"
          className="auth-hero-cta"
          onClick={() => setShowCreate((v) => !v)}
        >
          <Plus className="mr-2 h-4 w-4" />
          {showCreate ? 'Close' : 'Add user'}
        </Button>
      </div>

      {showCreate ? (
        <form
          onSubmit={createUser}
          className={cn('grid gap-3 rounded-xl border-0 p-4 shadow-none md:grid-cols-2 lg:grid-cols-3', adminGlassCard)}
        >
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">RBX Username</label>
            <Input
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              placeholder="rbx_username"
              className={fieldClass}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Password</label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min 8 chars, mixed case, number, symbol"
              className={fieldClass}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Name (optional)</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className={selectClass}
            >
              <option value="STUDENT">Student</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-foreground">Group (optional)</label>
            <select
              value={form.groupId}
              onChange={(e) => setForm((f) => ({ ...f, groupId: e.target.value }))}
              className={selectClass}
            >
              <option value="">No group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="hero" className="auth-hero-cta" disabled={creating}>
              {creating ? 'Creating…' : 'Create user'}
            </Button>
          </div>
          {createError ? (
            <p className="text-sm text-destructive md:col-span-2 lg:col-span-3" role="alert">
              {createError}
            </p>
          ) : null}
        </form>
      ) : null}

      <div className={cn('overflow-hidden rounded-xl border-0 shadow-none', adminGlassCard)}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Pro</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="min-w-[220px] text-right">Credentials</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No users
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="max-w-[200px] truncate font-medium" title={u.email}>
                    {u.username ?? u.email}
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate text-muted-foreground">
                    {u.name ?? '—'}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        studentGlassPill,
                        u.role === 'ADMIN' ? 'text-primary' : 'opacity-90',
                      )}
                    >
                      {u.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <select
                      className={selectClass}
                      value={u.groupId ?? ''}
                      disabled={pendingKey === `${u.id}:group`}
                      onChange={(e) =>
                        patchUser(u.id, 'group', { groupId: e.target.value === '' ? null : e.target.value })
                      }
                    >
                      <option value="">No group</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>
                    {u.isPro ? (
                      <span className={cn(studentGlassPill, 'text-violet-900 dark:text-violet-200')}>Pro</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-normal">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(adminGlassOutlineButton)}
                        disabled={pendingKey === `${u.id}:pro`}
                        onClick={() => patchUser(u.id, 'pro', { isPro: !u.isPro })}
                      >
                        {u.isPro ? 'Revoke Pro' : 'Grant Pro'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(adminGlassOutlineButton)}
                        disabled={
                          pendingKey === `${u.id}:role` ||
                          (u.role === 'ADMIN' && u.id === currentUserId)
                        }
                        title={
                          u.role === 'ADMIN' && u.id === currentUserId
                            ? 'You cannot remove your own admin role'
                            : undefined
                        }
                        onClick={() =>
                          patchUser(u.id, 'role', {
                            role: u.role === 'ADMIN' ? 'STUDENT' : 'ADMIN',
                          })
                        }
                      >
                        {u.role === 'ADMIN' ? 'Revoke admin' : 'Grant admin'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages} · {total} users
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(adminGlassOutlineButton)}
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(adminGlassOutlineButton)}
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
