import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { TwitchStatusProvider } from "./contexts/TwitchStatusContext";
import { HalloweenThemeProvider } from "./contexts/HalloweenThemeContext";

createRoot(document.getElementById("root")!).render(
  <TwitchStatusProvider>
    <HalloweenThemeProvider>
      <App />
    </HalloweenThemeProvider>
  </TwitchStatusProvider>
);
