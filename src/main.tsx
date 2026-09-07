import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProvider } from "./contexts/AppContext";
import App from "./App.tsx";
import "./index.css";
import { warmupBackend } from "./services/api";
import { registerServiceWorker } from "./pwa/registerServiceWorker";

// Ping backend early so Render free tier is awake by the time the user logs in.
warmupBackend();

registerServiceWorker();


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>
);
