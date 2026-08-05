export function LoadingScreen() {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-surface">
      <div
        className="size-32 animate-spin rounded-full border-2 border-neutral-200 border-t-income dark:border-neutral-700"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
