import { useEffect } from "react";
import { useSettingsStore } from "@/app/settingsStore";
import { SettingsService } from "@/services/SettingsService";

export const THEME_CACHE_KEY = "nexus-theme-cache";

/**
 * Applies the resolved theme to <html class="dark">. Dexie's Settings row is
 * the source of truth; a tiny localStorage cache exists only so
 * index.html's inline script can paint the right theme before React/Dexie
 * are ready, avoiding a flash of the wrong theme. That cache is never read
 * by application logic — only written, as a side effect, to keep it fresh.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const settings = useSettingsStore((s) => s.settings);

  useEffect(() => {
    if (!settings) return;

    const resolved = SettingsService.resolveTheme(settings.theme);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    localStorage.setItem(THEME_CACHE_KEY, resolved);

    if (settings.theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = () => {
        const next = mq.matches ? "dark" : "light";
        document.documentElement.classList.toggle("dark", next === "dark");
        localStorage.setItem(THEME_CACHE_KEY, next);
      };
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
  }, [settings]);

  return children;
}
