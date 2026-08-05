import { AlertTriangle, Info } from "lucide-react";
import type { DashboardAlert } from "@/services/DashboardService";
import { cn } from "@/utils/cn";

interface AlertCardProps {
  alert: DashboardAlert;
}

export function AlertCard({ alert }: AlertCardProps) {
  const Icon = alert.severity === "warning" ? AlertTriangle : Info;

  return (
    <div
      className={cn(
        "flex items-start gap-8 rounded-md border p-12 text-body-sm",
        alert.severity === "warning"
          ? "border-warning/40 bg-warning-subtle text-text-primary"
          : "border-info/40 bg-info-subtle text-text-primary",
      )}
    >
      <Icon
        className={cn(
          "mt-4 size-16 shrink-0",
          alert.severity === "warning" ? "text-warning" : "text-info",
        )}
        aria-hidden="true"
      />
      <span>{alert.message}</span>
    </div>
  );
}
