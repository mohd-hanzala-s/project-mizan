import { useCallback, useRef, useState } from "react";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const show = useCallback((text: string) => {
    clearTimeout(timeoutRef.current);
    setMessage(text);
    timeoutRef.current = setTimeout(() => setMessage(null), 2500);
  }, []);

  return { message, show };
}
