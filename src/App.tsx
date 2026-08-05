import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { useSettingsStore } from "@/app/settingsStore";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import { OnboardingFlow } from "@/features/onboarding/OnboardingFlow";
import { AppLockScreen } from "@/components/common/AppLockScreen";
import { AppRoutes } from "@/routes/router";
import { SampleDataService } from "@/services/SampleDataService";

export function App() {
  const settings = useSettingsStore((s) => s.settings);
  const isLoading = useSettingsStore((s) => s.isLoading);
  const load = useSettingsStore((s) => s.load);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (settings?.onboardingCompleted && settings.sampleDataRequested) {
      SampleDataService.fulfillIfRequested().then(load);
    }
  }, [settings?.onboardingCompleted, settings?.sampleDataRequested, load]);

  return (
    <ThemeProvider>
      {isLoading || !settings ? (
        <LoadingScreen />
      ) : !settings.onboardingCompleted ? (
        <OnboardingFlow />
      ) : settings.appLockEnabled && settings.appLockPinHash && !unlocked ? (
        <AppLockScreen
          storedHash={settings.appLockPinHash}
          onUnlock={() => setUnlocked(true)}
        />
      ) : (
        <BrowserRouter
          basename={import.meta.env.BASE_URL}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <AppRoutes />
        </BrowserRouter>
      )}
    </ThemeProvider>
  );
}
