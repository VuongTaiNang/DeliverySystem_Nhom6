import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AccountRoute from "./AccountRoute";
import AuthGate from "./AuthGate";

const path = window.location.pathname.toLowerCase();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate>
      {path === "/account" ? <AccountRoute /> : <App />}
    </AuthGate>
  </StrictMode>,
);
