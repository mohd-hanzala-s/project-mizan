import { Button } from "@/components/ui/button";

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-24"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative flex w-full max-w-[360px] flex-col gap-16 rounded-lg bg-surface-card p-24 shadow-floating">
        <div className="flex flex-col gap-8">
          <h2 className="text-h3 text-text-primary">{title}</h2>
          <p className="text-body-sm text-text-secondary">{description}</p>
        </div>
        <div className="flex justify-end gap-8">
          <Button variant="tertiary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
