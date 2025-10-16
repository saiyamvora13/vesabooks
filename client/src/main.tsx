import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import App from "./App";
import i18n from "./i18n";
import "./index.css";

// Global handler for unhandled rejections - for debugging
const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  console.error('🔴 UNHANDLED REJECTION CAUGHT:', {
    reason: event.reason,
    reasonType: typeof event.reason,
    reasonConstructor: event.reason?.constructor?.name,
    promise: event.promise,
    stack: event.reason?.stack
  });
  
  // Prevent the default behavior to stop Vite overlay
  event.preventDefault();
};

// Register the handler
window.addEventListener('unhandledrejection', handleUnhandledRejection);

createRoot(document.getElementById("root")!).render(
  <I18nextProvider i18n={i18n}>
    <App />
  </I18nextProvider>
);
