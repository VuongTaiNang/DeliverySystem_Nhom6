import type { ReactNode } from "react";

/** Shared Operations shell. Business screens are owned by the respective feature teams. */
export type OperationsSection = "orders" | "routes" | "incidents" | "settlements";

export const operationsItems: { key: OperationsSection; title: string; icon: string }[] = [
  { key: "orders", title: "Đơn hàng", icon: "▤" },
  { key: "routes", title: "Tuyến giao hàng", icon: "↔" },
  { key: "incidents", title: "Khiếu nại", icon: "!" },
  { key: "settlements", title: "Đối soát COD", icon: "₫" },
];

export function OperationsSidebar({
  section,
  onSectionChange,
}: {
  section: OperationsSection;
  onSectionChange: (section: OperationsSection) => void;
}) {
  return (
    <aside className="sidebar operations-sidebar" aria-label="Thanh điều hướng Operations">
      <div className="brand operations-brand">
        <span className="brand-icon">E</span>
        express<span className="brand-dot">.</span>
      </div>
      <p className="nav-caption">OPERATIONS / QUẢN LÝ</p>
      <nav aria-label="Điều hướng Operations">
        {operationsItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={section === item.key ? "nav active" : "nav"}
            aria-current={section === item.key ? "page" : undefined}
            onClick={() => onSectionChange(item.key)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.title}
          </button>
        ))}
      </nav>
      <div className="sidebar-note">
        <strong>EXPRESS Operations</strong>
        <p>Quản lý vận hành trên cùng một hệ thống.</p>
      </div>
    </aside>
  );
}

export function OperationsHeader({
  userName,
  section,
  signingOut,
  onLogout,
}: {
  userName: string;
  section: OperationsSection;
  signingOut: boolean;
  onLogout: () => void;
}) {
  return (
    <header className="topbar operations-topbar">
      <div className="operations-header-title">
        <strong>EXPRESS / Operations</strong>
        <span>{operationsItems.find((item) => item.key === section)?.title}</span>
      </div>
      <div className="account-controls">
        <span className="operations-username" title={userName}>{userName}</span>
        <button type="button" onClick={onLogout} disabled={signingOut}>
          {signingOut ? "Đang thoát…" : "Đăng xuất"}
        </button>
      </div>
    </header>
  );
}

/** Reusable container for Operations modules. */
export default function OperationsLayout({
  section,
  onSectionChange,
  userName,
  signingOut = false,
  onLogout,
  children,
}: {
  section: OperationsSection;
  onSectionChange: (section: OperationsSection) => void;
  userName: string;
  signingOut?: boolean;
  onLogout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="app operations-app">
      <OperationsSidebar section={section} onSectionChange={onSectionChange} />
      <main className="operations-main">
        <OperationsHeader section={section} userName={userName} signingOut={signingOut} onLogout={onLogout} />
        <div className="content operations-content">{children}</div>
      </main>
    </div>
  );
}
