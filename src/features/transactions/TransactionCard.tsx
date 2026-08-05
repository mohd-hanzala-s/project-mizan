import { useRef, useState } from "react";
import { Trash2, Pencil, Repeat, StickyNote } from "lucide-react";
import type { Category, Transaction } from "@/types/entities";
import { DynamicIcon } from "@/components/common/DynamicIcon";
import { cn } from "@/utils/cn";

interface TransactionCardProps {
  transaction: Transaction;
  category: Category | undefined;
  onDelete: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}

const SWIPE_ACTION_THRESHOLD = 72;
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE = 10;

export function TransactionCard({
  transaction,
  category,
  onDelete,
  onEdit,
  onDuplicate,
}: TransactionCardProps) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const longPressCancelled = useRef(false);

  const isTransfer = transaction.type === "transfer";

  function handlePointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    startY.current = e.clientY;
    longPressCancelled.current = false;
    // Transfers can't be duplicated — one leg alone would break the
    // linked-entry model. Only delete (which cascades to both legs).
    longPressTimer.current = setTimeout(() => {
      if (!longPressCancelled.current && !isTransfer) onDuplicate();
    }, LONG_PRESS_MS);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (
      Math.abs(dx) > LONG_PRESS_MOVE_TOLERANCE ||
      Math.abs(dy) > LONG_PRESS_MOVE_TOLERANCE
    ) {
      longPressCancelled.current = true;
      clearTimeout(longPressTimer.current);
    }
    // Transfers aren't editable yet — clamp right-swipe to 0 rather than
    // reveal an "Edit" affordance that won't do anything.
    setDragX(isTransfer ? Math.min(dx, 0) : dx);
  }

  function handlePointerUp() {
    clearTimeout(longPressTimer.current);
    setDragging(false);
    if (dragX <= -SWIPE_ACTION_THRESHOLD) {
      onDelete();
    } else if (dragX >= SWIPE_ACTION_THRESHOLD && !isTransfer) {
      onEdit();
    }
    setDragX(0);
  }

  const amountColor = isTransfer
    ? "text-info"
    : transaction.type === "expense"
      ? "text-expense"
      : "text-income";
  const amountPrefix = isTransfer
    ? transaction.transferDirection === "credit"
      ? "+"
      : "−"
    : transaction.type === "expense"
      ? "−"
      : "+";

  return (
    <div className="relative overflow-hidden">
      {/* Action backdrops, revealed as the card slides */}
      <div className="absolute inset-0 flex items-center justify-between px-24">
        <span
          className={cn(
            "flex items-center gap-8 text-body-sm font-medium text-income",
            dragX < 0 && "invisible",
          )}
        >
          <Pencil className="size-16" aria-hidden="true" /> Edit
        </span>
        <span
          className={cn(
            "flex items-center gap-8 text-body-sm font-medium text-expense",
            dragX > 0 && "invisible",
          )}
        >
          Delete <Trash2 className="size-16" aria-hidden="true" />
        </span>
      </div>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ transform: `translateX(${dragX}px)` }}
        className={cn(
          "relative flex items-center gap-12 bg-surface-card px-16 py-12 touch-pan-y",
          !dragging && "transition-transform duration-standard",
        )}
      >
        <span
          className="flex size-40 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: category ? `${category.color}22` : undefined,
            color: category?.color,
          }}
        >
          {category ? (
            <DynamicIcon name={category.icon} className="size-24" />
          ) : (
            <StickyNote className="size-24" aria-hidden="true" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-medium text-text-primary">
            {transaction.description}
          </p>
          <p className="truncate text-body-sm text-text-secondary">
            {category?.name ?? "Uncategorized"} ·{" "}
            {new Date(transaction.transactionDate).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
            {transaction.recurringRuleId && (
              <Repeat className="ml-4 inline size-12" aria-hidden="true" />
            )}
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 tabular-nums text-body-lg font-semibold",
            amountColor,
          )}
        >
          {amountPrefix}₹{transaction.amount.toLocaleString("en-IN")}
        </span>
      </div>
    </div>
  );
}
