import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { registerServiceWorker } from "./pwa";
import "./styles.css";

const appRoot = document.querySelector<HTMLDivElement>("#game-root");

if (!appRoot) {
  throw new Error("Missing #game-root container");
}

createRoot(appRoot).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
