import OperationsLayout from "./OperationsLayout";
import type { OperationsSection } from "./OperationsLayout";
import OperationsStaffPage from "./OperationsStaffPage";
import { useAuth } from "./auth/context";
import "./App.css";
import "./OperationsLayout.css";

export default function OperationsStaffRoute() {
  const { user, logout, openAuth } = useAuth();

  if (!user) {
    return (
      <main className="content">
        <section className="panel">
          <h2>Vui lòng đăng nhập</h2>
          <p className="muted">Bạn cần đăng nhập bằng tài khoản Operations để quản lý nhân viên.</p>
          <button type="button" className="primary" onClick={() => openAuth("login")}>Đăng nhập</button>
        </section>
      </main>
    );
  }

  if (user.role !== "operations") {
    return (
      <main className="content">
        <section className="panel">
          <h2>Không có quyền truy cập</h2>
          <p className="muted">Chức năng này chỉ dành cho Operations.</p>
          <button type="button" onClick={() => window.location.assign("/dashboard")}>Quay lại</button>
        </section>
      </main>
    );
  }

  function navigate(section: OperationsSection) {
    const path: Record<OperationsSection, string> = {
      orders: "/dispatch",
      routes: "/operations/routes",
      staff: "/operations/staff-management",
      incidents: "/incidents",
      settlements: "/settlements",
    };
    window.location.assign(path[section]);
  }

  return (
    <OperationsLayout
      section="staff"
      onSectionChange={navigate}
      userName={user.name}
      onLogout={() => void logout()}
    >
      <OperationsStaffPage />
    </OperationsLayout>
  );
}
