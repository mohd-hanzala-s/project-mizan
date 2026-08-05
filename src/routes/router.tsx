import { Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { TransactionsPage } from "@/features/transactions/TransactionsPage";
import { AccountsPage } from "@/features/accounts/AccountsPage";
import { AccountDetailPage } from "@/features/accounts/AccountDetailPage";
import { BudgetsPage } from "@/features/budgets/BudgetsPage";
import { LoansPage } from "@/features/loans/LoansPage";
import { RecurringPage } from "@/features/recurring/RecurringPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { ReportsPage } from "@/features/reports/ReportsPage";
import { InsightsPage } from "@/features/insights/InsightsPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/accounts/:id" element={<AccountDetailPage />} />
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/loans" element={<LoansPage />} />
        <Route path="/recurring" element={<RecurringPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
