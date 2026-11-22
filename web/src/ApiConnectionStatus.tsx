import { useEffect, useState } from "react";
import { ApiError, request } from "./lib/http";
import "./ApiConnectionStatus.css";

type Health = { status: string; database: string };
type State = "checking" | "ready" | "database" | "offline";

export default function ApiConnectionStatus() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const result = await request<Health>("/health");
        if (!active) return;
        setState(result.status === "ok" && result.database === "connected"
          ? "ready" : "database");
      } catch (error) {
        if (!active) return;
        setState(error instanceof ApiError && error.status === 503
          ? "database" : "offline");
      }
    };

    void check();
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "hidden") void check();
    }, 45000);
    const onFocus = () => { void check(); };
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const labels: Record<State, string> = {
    checking: "Đang kiểm tra API…",
    ready: "API hoạt động",
    database: "SQL Server chưa sẵn sàng",
    offline: "Mất kết nối API",
  };

  return (
    <span className={"api-connection api-connection--" + state}
      title={labels[state]} role="status">
      <span aria-hidden="true" className="api-connection__dot" />
      {labels[state]}
    </span>
  );
}
