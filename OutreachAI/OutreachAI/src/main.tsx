import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Supabase auth can trigger "Lock broken by another request" (IndexedDB/LockManager) when
// multiple tabs are open or the lock is stolen. Catch so it doesn't show as uncaught.
window.addEventListener("unhandledrejection", (event) => {
  const msg = event.reason?.message ?? String(event.reason);
  if (
    event.reason?.name === "AbortError" &&
    typeof msg === "string" &&
    msg.includes("Lock broken by another request")
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
