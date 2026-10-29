import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "./contexts/AppContext";
import App from "./App.tsx";
import "./index.css";
import { warmupBackend } from "./services/api";
import { registerServiceWorker } from "./pwa/registerServiceWorker";

// Ping the configured backend early so it is ready by the time the user logs in.
warmupBackend();

registerServiceWorker();


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>
);
