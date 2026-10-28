import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AccountRoute from "./AccountRoute";
import OperationsStaffRoute from "./OperationsStaffRoute";
import AuthGate from "./AuthGate";
import "./noticeAutoHide.css";

const LOCATION_EVENT = "express:location-change";
const originalPushState = window.history.pushState.bind(window.history);
const originalReplaceState = window.history.replaceState.bind(window.history);

window.history.pushState = (...args) => {
  originalPushState(...args);
  window.dispatchEvent(new Event(LOCATION_EVENT));
};

window.history.replaceState = (...args) => {
  originalReplaceState(...args);
  window.dispatchEvent(new Event(LOCATION_EVENT));
};

function RootRouter() {
  const [path, setPath] = useState(() => window.location.pathname.toLowerCase());

  useEffect(() => {
    const syncPath = () => setPath(window.location.pathname.toLowerCase());
    window.addEventListener("popstate", syncPath);
    window.addEventListener(LOCATION_EVENT, syncPath);

    return () => {
      window.removeEventListener("popstate", syncPath);
      window.removeEventListener(LOCATION_EVENT, syncPath);
    };
  }, []);

  if (path === "/account") {
    return <AccountRoute />;
  }

  if (path === "/operations/staff-management") {
    return <OperationsStaffRoute />;
  }

  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate>
      <RootRouter />
    </AuthGate>
  </StrictMode>,
);
