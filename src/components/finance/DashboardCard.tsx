interface DashboardCardProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardCard({ title, action, children }: DashboardCardProps) {
  return (
    <section className="flex flex-col gap-12 rounded-lg border border-border bg-surface-card p-16 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-overline text-text-tertiary">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
