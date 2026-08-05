import { useEffect, useState } from "react";
import { db } from "@/database/db";
import type { Category } from "@/types/entities";
import { DynamicIcon } from "@/components/common/DynamicIcon";
import { cn } from "@/utils/cn";

interface CategorySelectorProps {
  value: string | null;
  onChange: (categoryId: string) => void;
  /** Category the categorization engine suggested, if any — shown with a
   * subtle "Suggested" badge so the user can see and correct it (§3
   * SmartEntryInput: "live parsing feedback and manual correction"). */
  suggestedCategoryId?: string | null;
}

export function CategorySelector({
  value,
  onChange,
  suggestedCategoryId,
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    db.categories
      .toArray()
      .then((all) =>
        setCategories(
          all
            .filter((c) => !c.isArchived)
            .sort((a, b) => a.displayOrder - b.displayOrder),
        ),
      );
  }, []);

  return (
    <div
      role="radiogroup"
      aria-label="Category"
      className="grid grid-cols-4 gap-8"
    >
      {categories.map((category) => {
        const selected = value === category.id;
        const suggested = !selected && suggestedCategoryId === category.id;

        return (
          <button
            key={category.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(category.id)}
            className={cn(
              "flex min-h-touch flex-col items-center gap-4 rounded-md border p-8 text-center transition-colors duration-fast",
              selected
                ? "border-income bg-income-subtle"
                : suggested
                  ? "border-dashed border-income/60"
                  : "border-border bg-surface-card hover:bg-neutral-100 dark:hover:bg-neutral-800",
            )}
          >
            <span
              className="flex size-32 items-center justify-center rounded-full"
              style={{
                backgroundColor: `${category.color}22`,
                color: category.color,
              }}
            >
              <DynamicIcon name={category.icon} className="size-16" />
            </span>
            <span className="text-caption text-text-secondary">
              {category.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
