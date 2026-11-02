import type { Database } from '@/types/database'

export type MemberRole = Database['public']['Enums']['member_role']

export const roleLabels: Record<MemberRole, string> = {
  admin: 'Admin',
  agent: 'Agent',
  requester: 'Mitarbeiter',
}
