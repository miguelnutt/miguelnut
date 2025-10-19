import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { TwitchStatusProvider } from "./contexts/TwitchStatusContext";

createRoot(document.getElementById("root")!).render(
  <TwitchStatusProvider>
    <App />
  </TwitchStatusProvider>
);
