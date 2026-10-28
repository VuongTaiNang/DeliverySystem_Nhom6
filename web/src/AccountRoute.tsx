import AccountPage from "./AccountPage";
import { useAuth } from "./auth/context";
import "./App.css";

export default function AccountRoute() {
  const { user, openAuth } = useAuth();

  if (!user) {
    return (
      <main className="content">
        <section className="panel">
          <p className="eyebrow">TÀI KHOẢN</p>
          <h2>Vui lòng đăng nhập</h2>
          <p className="muted">Bạn cần đăng nhập để xem và cập nhật thông tin tài khoản.</p>
          <button type="button" className="primary" onClick={() => openAuth("login")}>
            Đăng nhập
          </button>
        </section>
      </main>
    );
  }

  const backPath = user.role === "operations"
    ? "/dispatch"
    : user.role === "staff"
      ? "/staff"
      : "/dashboard";

  return (
    <div className="app">
      <main className="main" style={{ width: "100%" }}>
        <header className="topbar">
          <button type="button" onClick={() => window.location.assign(backPath)}>
            ← Quay lại
          </button>
          <strong>EXPRESS / Tài khoản</strong>
          <span>{user.name}</span>
        </header>
        <div className="content">
          <AccountPage />
        </div>
      </main>
    </div>
  );
}
