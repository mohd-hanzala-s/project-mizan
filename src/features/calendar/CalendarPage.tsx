import { useEffect, useMemo, useState } from "react";
import { addDays, addMonths, format, startOfWeek, type Day } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTransactionsStore } from "@/features/transactions/transactionsStore";
import { useRecurringStore } from "@/features/recurring/recurringStore";
import { useLoansStore } from "@/features/loans/loansStore";
import { useSettingsStore } from "@/app/settingsStore";
import {
  CalendarService,
  type CalendarEvent,
  type CalendarEventKind,
} from "@/services/CalendarService";
import { CalendarView } from "./CalendarView";
import { WeekStrip } from "./WeekStrip";
import { CalendarEventRow } from "./CalendarEventRow";
import { SearchBar } from "@/components/forms/SearchBar";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";

type ViewMode = "month" | "week" | "day";

const KIND_FILTERS: { label: string; kinds: CalendarEventKind[] }[] = [
  { label: "All", kinds: [] },
  { label: "Transactions", kinds: ["transaction"] },
  { label: "Recurring", kinds: ["recurring"] },
  { label: "Loans", kinds: ["loan"] },
];

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function groupByDay(
  events: CalendarEvent[],
): { key: string; date: Date; events: CalendarEvent[] }[] {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = dayKey(e.date);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, list]) => ({ key, date: list[0].date, events: list }));
}

export function CalendarPage() {
  const transactions = useTransactionsStore((s) => s.transactions);
  const loadTransactions = useTransactionsStore((s) => s.load);
  const rules = useRecurringStore((s) => s.rules);
  const loadRecurring = useRecurringStore((s) => s.load);
  const loans = useLoansStore((s) => s.loans);
  const payments = useLoansStore((s) => s.payments);
  const loadLoans = useLoansStore((s) => s.load);
  const settings = useSettingsStore((s) => s.settings);
  const loadSettings = useSettingsStore((s) => s.load);

  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    () => new Date(),
  );
  const [query, setQuery] = useState("");
  const [kinds, setKinds] = useState<CalendarEventKind[]>([]);

  useEffect(() => {
    loadTransactions();
    loadRecurring();
    loadLoans();
    loadSettings();
  }, [loadTransactions, loadRecurring, loadLoans, loadSettings]);

  const firstDayOfWeek = (settings?.firstDayOfWeek ?? 0) as Day;

  const monthEvents = useMemo(
    () =>
      CalendarService.getMonthEvents(
        anchor.getFullYear(),
        anchor.getMonth(),
        transactions,
        rules,
        loans,
        payments,
      ),
    [anchor, transactions, rules, loans, payments],
  );

  const weekStart = useMemo(
    () => startOfWeek(anchor, { weekStartsOn: firstDayOfWeek }),
    [anchor, firstDayOfWeek],
  );

  const weekEvents = useMemo(() => {
    const weekEnd = addDays(weekStart, 6);
    if (weekStart.getMonth() !== anchor.getMonth()) {
      const prev = CalendarService.getMonthEvents(
        weekStart.getFullYear(),
        weekStart.getMonth(),
        transactions,
        rules,
        loans,
        payments,
      );
      return CalendarService.getWeekEvents(
        [...prev, ...monthEvents],
        weekStart,
      );
    }
    if (weekEnd.getMonth() !== anchor.getMonth()) {
      const next = CalendarService.getMonthEvents(
        weekEnd.getFullYear(),
        weekEnd.getMonth(),
        transactions,
        rules,
        loans,
        payments,
      );
      return CalendarService.getWeekEvents(
        [...monthEvents, ...next],
        weekStart,
      );
    }
    return CalendarService.getWeekEvents(monthEvents, weekStart);
  }, [weekStart, anchor, monthEvents, transactions, rules, loans, payments]);

  const visibleEvents = view === "week" ? weekEvents : monthEvents;
  const filtered = useMemo(
    () => CalendarService.filterEvents(visibleEvents, query, kinds),
    [visibleEvents, query, kinds],
  );

  const dayEvents = useMemo(
    () => CalendarService.getDayEvents(filtered, selectedDate ?? new Date()),
    [filtered, selectedDate],
  );

  function goPrev() {
    setAnchor((d) =>
      view === "month"
        ? addMonths(d, -1)
        : view === "week"
          ? addDays(d, -7)
          : addDays(d, -1),
    );
  }

  function goNext() {
    setAnchor((d) =>
      view === "month"
        ? addMonths(d, 1)
        : view === "week"
          ? addDays(d, 7)
          : addDays(d, 1),
    );
  }

  function goToday() {
    const now = new Date();
    setAnchor(now);
    setSelectedDate(now);
  }

  function selectDay(date: Date) {
    setSelectedDate(date);
    if (view === "day") setAnchor(date);
  }

  const title =
    view === "month"
      ? format(anchor, "MMMM yyyy")
      : view === "week"
        ? `${format(weekStart, "d MMM")} – ${format(addDays(weekStart, 6), "d MMM yyyy")}`
        : format(anchor, "EEEE, d MMM yyyy");

  const timelineGroups = groupByDay(filtered);

  return (
    <div className="flex flex-col gap-16 p-16 md:p-24">
      <div className="flex items-center justify-between">
        <h1 className="text-h2 text-text-primary">Calendar</h1>
        <div
          role="radiogroup"
          aria-label="Calendar view"
          className="inline-flex self-start rounded-md bg-neutral-100 p-4 dark:bg-neutral-800"
        >
          {(["month", "week", "day"] as ViewMode[]).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className={cn(
                "min-h-touch rounded-sm px-16 text-body-sm font-medium capitalize transition-colors duration-fast",
                view === v
                  ? "bg-surface-card text-text-primary shadow-card"
                  : "text-text-secondary",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-8">
        <Button
          variant="tertiary"
          size="sm"
          onClick={goPrev}
          aria-label="Previous period"
        >
          <ChevronLeft className="size-16" aria-hidden="true" />
        </Button>
        <p className="min-w-0 flex-1 truncate text-center text-h3 text-text-primary">
          {title}
        </p>
        <Button
          variant="tertiary"
          size="sm"
          onClick={goNext}
          aria-label="Next period"
        >
          <ChevronRight className="size-16" aria-hidden="true" />
        </Button>
        <Button variant="secondary" size="sm" onClick={goToday}>
          Today
        </Button>
      </div>

      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Search the calendar"
      />

      <div className="flex flex-wrap gap-8">
        {KIND_FILTERS.map((f) => {
          const active = f.kinds.join() === kinds.join();
          return (
            <button
              key={f.label}
              type="button"
              onClick={() => setKinds(f.kinds)}
              className={cn(
                "min-h-touch rounded-full border px-16 text-body-sm font-medium transition-colors duration-fast",
                active
                  ? "border-income bg-income-subtle text-income"
                  : "border-border bg-surface-card text-text-secondary",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {view === "month" && (
        <CalendarView
          year={anchor.getFullYear()}
          monthIndex={anchor.getMonth()}
          firstDayOfWeek={firstDayOfWeek}
          events={filtered}
          selectedDate={selectedDate}
          onSelectDay={selectDay}
        />
      )}
      {view === "week" && (
        <WeekStrip
          weekStart={weekStart}
          events={filtered}
          selectedDate={selectedDate}
          onSelectDay={selectDay}
        />
      )}

      {view === "month" && (
        <section className="flex flex-col gap-8">
          <h2 className="text-overline text-text-tertiary">
            {selectedDate ? format(selectedDate, "EEEE, d MMMM") : "Events"}
          </h2>
          {dayEvents.length === 0 ? (
            <p className="rounded-md border border-border bg-surface-card p-16 text-body-sm text-text-tertiary">
              No events for this day.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-md border border-border bg-surface-card">
              {dayEvents.map((e) => (
                <CalendarEventRow key={e.id} event={e} />
              ))}
            </div>
          )}
        </section>
      )}

      {(view === "week" || view === "day") && (
        <section className="flex flex-col gap-12">
          <h2 className="text-overline text-text-tertiary">Timeline</h2>
          {timelineGroups.length === 0 ? (
            <p className="rounded-md border border-border bg-surface-card p-16 text-body-sm text-text-tertiary">
              No events in this period.
            </p>
          ) : (
            <div className="flex flex-col gap-12">
              {timelineGroups.map((group) => (
                <div key={group.key} className="flex flex-col gap-4">
                  <h3 className="px-4 text-body-sm font-medium text-text-secondary">
                    {format(group.date, "EEEE, d MMM yyyy")}
                  </h3>
                  <div className="flex flex-col divide-y divide-border-subtle overflow-hidden rounded-md border border-border bg-surface-card">
                    {group.events.map((e) => (
                      <CalendarEventRow key={e.id} event={e} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
