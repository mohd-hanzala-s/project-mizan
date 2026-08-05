import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
import { NAV_ITEMS } from "@/constants/navigation";
import { cn } from "@/utils/cn";

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MoreSheet({ open, onClose }: MoreSheetProps) {
  const remainingItems = NAV_ITEMS.filter((item) => !item.primary);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 landscape:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="More destinations"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-xl bg-surface-card p-24 shadow-floating"
        style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-16 flex items-center justify-between">
          <h2 className="text-h3 text-text-primary">More</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex size-40 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="size-24" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-16">
          {remainingItems.map(({ id, label, path, icon: Icon }) => (
            <NavLink
              key={id}
              to={path}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex min-h-touch flex-col items-center gap-8 rounded-md p-12 text-body-sm font-medium",
                  isActive
                    ? "text-income"
                    : "text-text-secondary hover:bg-neutral-100 dark:hover:bg-neutral-800",
                )
              }
            >
              <Icon className="size-24" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}
