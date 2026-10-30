import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { DialogHost } from "./components/DialogHost";
import { TooltipLayer } from "./components/TooltipLayer";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("missing #root element");

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <DialogHost>
        <App />
      </DialogHost>
      <TooltipLayer />
    </AppErrorBoundary>
  </StrictMode>,
);
