import AccountPage from "./AccountPage";
import { useAuth } from "./auth/context";
import "./App.css";

export default function AccountRoute() {
  const { user, openAuth } = useAuth();
  const backPath = user?.role === "operations"
    ? "/dispatch"
    : user?.role === "staff"
      ? "/staff"
      : "/dashboard";

  return (
    <div className="account-route">
      <header className="account-route__header">
        <div className="account-route__header-inner">
          <button
            type="button"
            className="account-route__back"
            onClick={() => window.location.assign(user ? backPath : "/")}
          >
            ← Quay lại
          </button>
          <div className="account-route__brand" aria-label="EXPRESS / Tài khoản">
            <span className="account-route__logo" aria-hidden="true">E</span>
            <span className="account-route__brand-name">express<span>.</span></span>
            <span className="account-route__separator" aria-hidden="true">/</span>
            <strong>Tài khoản</strong>
          </div>
          <span className="account-route__user" title={user?.name || ""}>
            {user?.name || "Khách"}
          </span>
        </div>
      </header>

      <main className="account-route__main">
        {user ? (
          <AccountPage />
        ) : (
          <section className="panel account-card">
            <p className="eyebrow">TÀI KHOẢN</p>
            <h2>Vui lòng đăng nhập</h2>
            <p className="muted">Bạn cần đăng nhập để xem và cập nhật thông tin tài khoản.</p>
            <button type="button" className="primary" onClick={() => openAuth("login")}>
              Đăng nhập
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
