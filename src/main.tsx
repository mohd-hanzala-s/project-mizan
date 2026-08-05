import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import "./index.css";

// Undo public/404.html's redirect encoding before React Router mounts.
(function restorePathFromGithubPagesRedirect() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");
  if (redirect) {
    params.delete("redirect");
    const remaining = params.toString();
    const restoredPath = window.location.pathname.replace(/\/$/, "") + redirect;
    window.history.replaceState(
      null,
      "",
      restoredPath + (remaining ? `?${remaining}` : "") + window.location.hash,
    );
  }
})();

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
