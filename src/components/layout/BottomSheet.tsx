import { useEffect } from "react";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div
        className="absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col rounded-t-xl bg-surface-card shadow-floating"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-24 py-16">
          <h2 className="text-h3 text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex size-40 items-center justify-center rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="size-24" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto p-24">{children}</div>
      </div>
    </div>
  );
}
