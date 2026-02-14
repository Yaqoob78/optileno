// main.tsx - UPDATED VERSION
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { installApiFetchProxy } from "./services/api/installApiFetchProxy";

import "./styles/tailwind.css";
import "./styles/global.css";
import "./styles/themes.css";
import "./styles/components.css";
import "./styles/animations.css";

installApiFetchProxy();

// ===== REACT RENDER =====
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
