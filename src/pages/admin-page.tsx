import { CategoriesSection } from '@/components/categories-section'
import { InvitationsSection } from '@/components/invitations-section'
import { MembersSection } from '@/components/members-section'
import { TemplatesSection } from '@/components/templates-section'
import { useAdminData } from '@/hooks/use-admin-data'
import { useInvitations } from '@/hooks/use-invitations'
import { useMembership } from '@/hooks/use-membership'
import { useReplyTemplates } from '@/hooks/use-templates'

export function AdminPage() {
  const { organizationId } = useMembership()
  const admin = useAdminData(organizationId)
  const templates = useReplyTemplates(organizationId)
  const invitations = useInvitations(organizationId)

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Verwaltung</h1>

      {admin.loading && <p className="text-muted-foreground">Wird geladen …</p>}

      {admin.error && (
        <p role="alert" className="text-destructive">
          {admin.error}
        </p>
      )}

      {!admin.loading && !admin.error && (
        <>
          <MembersSection
            members={admin.members}
            onAdd={admin.addMember}
            onChangeRole={admin.changeRole}
            onRemove={admin.removeMember}
          />
          <InvitationsSection
            invitations={invitations.invitations}
            onInvite={invitations.invite}
            onRevoke={invitations.revoke}
          />
          <CategoriesSection
            categories={admin.categories}
            onAdd={admin.addCategory}
            onRename={admin.renameCategory}
            onDelete={admin.deleteCategory}
          />
          <TemplatesSection
            templates={templates.templates}
            onAdd={templates.add}
            onUpdate={templates.update}
            onRemove={templates.remove}
          />
        </>
      )}
    </div>
  )
}
