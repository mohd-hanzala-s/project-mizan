import { ThemeToggle } from "./ThemeToggle";
import { AppLockSettings } from "./AppLockSettings";

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-24 p-24">
      <h1 className="text-h2 text-text-primary">Settings</h1>

      <section className="flex flex-col gap-12">
        <h2 className="text-overline text-text-tertiary">Appearance</h2>
        <ThemeToggle />
      </section>

      <section className="flex flex-col gap-12">
        <h2 className="text-overline text-text-tertiary">Security</h2>
        <AppLockSettings />
      </section>

      <p className="text-body-sm text-text-tertiary">
        Currency, categories, backups, and more settings arrive alongside their
        respective phases.
      </p>
    </div>
  );
}
