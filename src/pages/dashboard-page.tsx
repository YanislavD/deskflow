import { Link } from 'react-router'
import { Plus } from 'lucide-react'
import { StatusBadge } from '@/components/ticket-badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDashboard, type DashboardStats } from '@/hooks/use-dashboard'
import { useMembership } from '@/hooks/use-membership'
import { formatDateTime } from '@/lib/format'
import {
  priorityBarColors,
  priorityLabels,
  statusBarColors,
  statusLabels,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/ticket-labels'
import { cn } from '@/lib/utils'

function StatCard({
  label,
  value,
  to,
  tone,
}: {
  label: string
  value: number
  to: string
  tone?: 'danger'
}) {
  return (
    <Link to={to} className="group block">
      <Card className="transition-colors group-hover:border-primary/50">
        <CardContent>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div
            className={cn(
              'mt-1 text-3xl font-semibold tabular-nums',
              tone === 'danger' && value > 0 && 'text-destructive',
            )}
          >
            {value}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

type BarRow = { key: string; label: string; count: number; color: string; to: string }

function Bars({ title, rows, empty }: { title: string; rows: BarRow[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  const hasData = rows.some((r) => r.count > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <li key={r.key}>
                <Link to={r.to} className="group block">
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="group-hover:text-primary">{r.label}</span>
                    <span className="text-muted-foreground tabular-nums">{r.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className={cn('h-2 rounded-full', r.color)}
                      style={{ width: `${(r.count / max) * 100}%` }}
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function statusRows(stats: DashboardStats): BarRow[] {
  return (Object.keys(statusLabels) as TicketStatus[]).map((s) => ({
    key: s,
    label: statusLabels[s],
    count: stats.by_status[s] ?? 0,
    color: statusBarColors[s],
    to: `/tickets?status=${s}`,
  }))
}

// Wichtigstes zuerst: kritisch -> niedrig
function priorityRows(stats: DashboardStats): BarRow[] {
  return (['kritisch', 'hoch', 'mittel', 'niedrig'] as TicketPriority[]).map((p) => ({
    key: p,
    label: priorityLabels[p],
    count: stats.by_priority[p] ?? 0,
    color: priorityBarColors[p],
    to: `/tickets?priority=${p}`,
  }))
}

export function DashboardPage() {
  const { role } = useMembership()
  const isStaff = role === 'admin' || role === 'agent'
  const { stats, recent, loading, error } = useDashboard()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Übersicht</h1>
        <Button asChild size="sm">
          <Link to="/tickets/new">
            <Plus /> Neues Ticket
          </Link>
        </Button>
      </div>

      {loading && <p className="text-muted-foreground">Wird geladen …</p>}

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}

      {stats && stats.total === 0 && (
        <Card>
          <CardContent className="space-y-3 text-center">
            <p className="text-muted-foreground">Es gibt noch keine Tickets.</p>
            <Button asChild>
              <Link to="/tickets/new">Erstes Ticket erstellen</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {stats && stats.total > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={isStaff ? 'Offene Tickets' : 'Meine offenen Tickets'} value={stats.open} to="/tickets" />
            <StatCard label="Überfällig" value={stats.overdue} to="/tickets?overdue=1" tone="danger" />
            {isStaff && (
              <>
                <StatCard label="Mir zugewiesen" value={stats.mine} to="/tickets?mine=1" />
                <StatCard label="Nicht zugewiesen" value={stats.unassigned} to="/tickets?unassigned=1" />
              </>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Bars title="Tickets nach Status" rows={statusRows(stats)} empty="Keine Tickets." />
            <Bars
              title="Offene Tickets nach Priorität"
              rows={priorityRows(stats)}
              empty="Keine offenen Tickets."
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Zuletzt aktualisiert</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {recent.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <Link to={`/tickets/${t.id}`} className="min-w-0 flex-1 truncate text-sm hover:text-primary">
                      <span className="mr-2 font-mono text-muted-foreground">#{t.number}</span>
                      {t.title}
                    </Link>
                    <StatusBadge status={t.status} />
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      {formatDateTime(t.updated_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
