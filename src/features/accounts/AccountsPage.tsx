import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Wallet, ArchiveRestore } from 'lucide-react'
import { useAccountsStore } from './accountsStore'
import { AccountForm } from './AccountForm'
import { AccountCard } from '@/components/finance/AccountCard'
import { BottomSheet } from '@/components/layout/BottomSheet'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { AccountService } from '@/services/AccountService'

export function AccountsPage() {
  const accounts = useAccountsStore((s) => s.accounts)
  const archivedAccounts = useAccountsStore((s) => s.archivedAccounts)
  const load = useAccountsStore((s) => s.load)
  const [addOpen, setAddOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    load()
  }, [load])

  async function handleUnarchive(id: string) {
    await AccountService.unarchive(id)
    load()
  }

  return (
    <div className="flex flex-col gap-24 p-16 md:p-24">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 text-text-primary">Accounts</h1>
        <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-16" aria-hidden="true" /> Add
        </Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add an account to start tracking balances."
          actionLabel="Add an account"
          onAction={() => setAddOpen(true)}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {accounts.map((account) => (
            <button
              key={account.id}
              onClick={() => navigate(`/accounts/${account.id}`)}
              className="text-left"
            >
              <AccountCard account={account} />
            </button>
          ))}
        </div>
      )}

      {archivedAccounts.length > 0 && (
        <div className="flex flex-col gap-8">
          <h2 className="text-overline text-text-tertiary">Archived</h2>
          {archivedAccounts.map((account) => (
            <div
              key={account.id}
              className="flex min-h-touch items-center gap-12 rounded-md border border-border-subtle bg-surface px-16 py-12 opacity-70"
            >
              <span className="min-w-0 flex-1 truncate text-body text-text-secondary">
                {account.name}
              </span>
              <button
                type="button"
                onClick={() => handleUnarchive(account.id)}
                className="flex items-center gap-4 text-body-sm font-medium text-income"
              >
                <ArchiveRestore className="size-16" aria-hidden="true" /> Restore
              </button>
            </div>
          ))}
        </div>
      )}

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add Account">
        <AccountForm
          onSaved={() => {
            setAddOpen(false)
            load()
          }}
          onCancel={() => setAddOpen(false)}
        />
      </BottomSheet>
    </div>
  )
}
