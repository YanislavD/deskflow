import { CategoriesSection } from '@/components/categories-section'
import { MembersSection } from '@/components/members-section'
import { useAdminData } from '@/hooks/use-admin-data'
import { useMembership } from '@/hooks/use-membership'

export function AdminPage() {
  const { organizationId } = useMembership()
  const admin = useAdminData(organizationId)

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
          <CategoriesSection
            categories={admin.categories}
            onAdd={admin.addCategory}
            onRename={admin.renameCategory}
            onDelete={admin.deleteCategory}
          />
        </>
      )}
    </div>
  )
}
