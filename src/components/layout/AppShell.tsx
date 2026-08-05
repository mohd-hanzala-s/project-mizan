import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { NavigationRail } from "./NavigationRail";
import { BottomNavigation } from "./BottomNavigation";
import { MoreSheet } from "./MoreSheet";
import { TopAppBar } from "./TopAppBar";
import { FloatingActionButton } from "./FloatingActionButton";
import { BottomSheet } from "./BottomSheet";
import { Toast } from "@/components/common/Toast";
import { useToast } from "@/hooks/useToast";
import { useTransactionsStore } from "@/features/transactions/transactionsStore";
import { TransactionEntrySheet } from "@/features/transactions/TransactionEntrySheet";
import { RecurringService } from "@/services/RecurringService";

export function AppShell() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { message, show } = useToast();

  const sheetOpen = useTransactionsStore((s) => s.sheetOpen);
  const editingTransaction = useTransactionsStore((s) => s.editingTransaction);
  const openAddSheet = useTransactionsStore((s) => s.openAddSheet);
  const closeSheet = useTransactionsStore((s) => s.closeSheet);
  const pendingUndo = useTransactionsStore((s) => s.pendingUndo);
  const dismissUndo = useTransactionsStore((s) => s.dismissUndo);
  const load = useTransactionsStore((s) => s.load);

  useEffect(() => {
    // Background processing (§4): generate any due recurring entries at
    // startup, then reload so the dashboard and lists see them. Idempotent
    // and single-flight, so this is safe alongside the Recurring page's own
    // load.
    load();
    RecurringService.generateDue().then(() => load());
  }, [load]);

  return (
    <div className="flex h-dvh w-full bg-surface">
      <NavigationRail />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <TopAppBar onScaffoldAction={show} />

        <main className="flex flex-1 flex-col overflow-y-auto">
          <Outlet />
        </main>

        <FloatingActionButton
          onClick={openAddSheet}
          className="absolute bottom-24 right-24 landscape:bottom-24 portrait:bottom-96"
        />

        <BottomNavigation
          onMoreClick={() => setMoreOpen(true)}
          moreActive={moreOpen}
        />
        <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editingTransaction ? "Edit Transaction" : "Add Transaction"}
      >
        <TransactionEntrySheet />
      </BottomSheet>

      {pendingUndo && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-96 z-50 flex justify-center px-24 landscape:bottom-24"
        >
          <div className="flex items-center gap-16 rounded-md bg-neutral-900 px-16 py-12 text-body-sm text-neutral-50 shadow-floating dark:bg-neutral-50 dark:text-neutral-900">
            <span>{pendingUndo.message}</span>
            <button
              type="button"
              onClick={() => {
                pendingUndo.onUndo();
                dismissUndo();
              }}
              className="font-semibold text-income underline"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      <Toast message={message} />
    </div>
  );
}
