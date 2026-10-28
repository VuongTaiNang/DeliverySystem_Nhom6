import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "./api";
import { useAuth } from "./auth/context";
import "./AccountPage.css";

export default function AccountPage() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [profile, setProfile] = useState({
    fullName: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    shopName: user?.shopName ?? "",
  });
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getAccount()
      .then((account) => {
        if (!active) return;
        setProfile({
          fullName: account.fullName ?? account.name ?? "",
          email: account.email ?? "",
          phone: account.phone ?? "",
          shopName: account.shopName ?? "",
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setNotice({
          kind: "error",
          text: error instanceof Error ? error.message : "Không tải được thông tin tài khoản.",
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.kind === "success" ? 4000 : 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingProfile) return;

    const fullName = profile.fullName.trim();
    const email = profile.email.trim();
    const phone = profile.phone.trim();

    if (!fullName || !email || !phone) {
      setNotice({ kind: "error", text: "Vui lòng nhập đầy đủ họ tên, email và số điện thoại." });
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await api.updateAccount({
        fullName,
        email,
        phone,
        shopName: profile.shopName.trim() || null,
      });
      updateUser(updated);
      setProfile({
        fullName: updated.fullName ?? updated.name,
        email: updated.email ?? "",
        phone: updated.phone ?? "",
        shopName: updated.shopName ?? "",
      });
      setNotice({ kind: "success", text: "Đã cập nhật thông tin tài khoản." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Không cập nhật được tài khoản.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingPassword) return;

    if (passwords.newPassword.length < 8) {
      setNotice({ kind: "error", text: "Mật khẩu mới phải có ít nhất 8 ký tự." });
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setNotice({ kind: "error", text: "Xác nhận mật khẩu mới không khớp." });
      return;
    }

    setSavingPassword(true);
    try {
      await api.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setNotice({ kind: "success", text: "Đã thay đổi mật khẩu thành công." });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "Không thay đổi được mật khẩu.",
      });
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return <section className="panel account-page"><p role="status">Đang tải thông tin tài khoản…</p></section>;
  }

  return (
    <div className="account-page">
      {notice && <div className={`notice ${notice.kind}`} role="status">{notice.text}</div>}

      <section className="panel account-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">TÀI KHOẢN</p>
            <h2>Thông tin cá nhân</h2>
            <p className="muted">Xem và cập nhật thông tin liên hệ của tài khoản.</p>
          </div>
        </div>

        <form onSubmit={submitProfile} className="account-form">
          <label>
            Họ và tên
            <input
              value={profile.fullName}
              onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
              maxLength={150}
              required
              disabled={savingProfile}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              maxLength={200}
              required
              disabled={savingProfile}
            />
          </label>
          <label>
            Số điện thoại
            <input
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              inputMode="tel"
              maxLength={20}
              required
              disabled={savingProfile}
            />
          </label>
          {user?.role === "customer" && (
            <label>
              Tên shop
              <input
                value={profile.shopName}
                onChange={(e) => setProfile({ ...profile, shopName: e.target.value })}
                maxLength={150}
                disabled={savingProfile}
                placeholder="Không bắt buộc"
              />
            </label>
          )}
          <div className="account-form__actions">
            <button type="submit" className="primary" disabled={savingProfile}>
              {savingProfile ? "Đang lưu…" : "Cập nhật thông tin"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel account-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">BẢO MẬT</p>
            <h2>Thay đổi mật khẩu</h2>
            <p className="muted">Nhập mật khẩu hiện tại trước khi đặt mật khẩu mới.</p>
          </div>
        </div>

        <form onSubmit={submitPassword} className="account-form account-form--password">
          <label>
            Mật khẩu hiện tại
            <input
              type="password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              required
              autoComplete="current-password"
              disabled={savingPassword}
            />
          </label>
          <label>
            Mật khẩu mới
            <input
              type="password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              minLength={8}
              required
              autoComplete="new-password"
              disabled={savingPassword}
            />
          </label>
          <label>
            Xác nhận mật khẩu mới
            <input
              type="password"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              minLength={8}
              required
              autoComplete="new-password"
              disabled={savingPassword}
            />
          </label>
          <div className="account-form__actions">
            <button type="submit" className="primary" disabled={savingPassword}>
              {savingPassword ? "Đang đổi…" : "Đổi mật khẩu"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
