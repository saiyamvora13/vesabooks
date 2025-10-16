import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import App from "./App";
import i18n from "./i18n";
import "./index.css";

// Immediately register global handler for unhandled rejections
// This MUST be done before any other code to ensure it catches everything
const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
  console.error('🔴 UNHANDLED REJECTION CAUGHT:', {
    reason: event.reason,
    reasonType: typeof event.reason,
    reasonConstructor: event.reason?.constructor?.name,
    promise: event.promise,
    stack: event.reason?.stack
  });
  
  // Always prevent the default behavior to stop Vite overlay
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  
  // Return false to further prevent default
  return false;
};

// Register as soon as possible with capture phase
window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

createRoot(document.getElementById("root")!).render(
  <I18nextProvider i18n={i18n}>
    <App />
  </I18nextProvider>
);
