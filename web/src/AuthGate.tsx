import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { api } from "./api";
import type { SessionUser } from "./api";
import { AuthContext } from "./auth/context";
import type { AuthMode } from "./auth/context";
import { requestPasswordResetOtp, resetPasswordByOtp } from "./auth/passwordReset";
import "./App.css";
import "./auth/auth.css";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  useEffect(() => {
    let active = true;
    api.getSession()
      .then((value) => { if (active) setUser(value); })
      .catch((error) => {
        if (active) setSessionError(error instanceof Error ? error.message : "Không kiểm tra được phiên đăng nhập.");
      })
      .finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sessionError) return;
    const timer = window.setTimeout(() => setSessionError(""), 4000);
    return () => window.clearTimeout(timer);
  }, [sessionError]);

  useEffect(() => {
    const expired = () => {
      localStorage.removeItem("express-user");
      localStorage.removeItem("express-token");
      setUser(null);
      setSessionError("Phiên đã hết hạn. Vui lòng đăng nhập lại.");
      setAuthMode("login");
      setAuthOpen(true);
    };
    window.addEventListener("express:session-expired", expired);
    return () => window.removeEventListener("express:session-expired", expired);
  }, []);

  useEffect(() => {
    const requested = (event: Event) => {
      const custom = event as CustomEvent<{ mode?: AuthMode }>;
      setAuthMode(custom.detail?.mode ?? "login");
      setAuthOpen(true);
    };
    window.addEventListener("express:auth-request", requested);
    return () => window.removeEventListener("express:auth-request", requested);
  }, []);

  async function logout() {
    try {
      await api.logout();
    } finally {
      localStorage.removeItem("express-token");
      localStorage.removeItem("express-user");
      setUser(null);
      setAuthOpen(false);
      setSessionError("");
    }
  }

  function openAuth(mode: AuthMode = "login") {
    setAuthMode(mode);
    setAuthOpen(true);
  }

  function closeAuth() {
    setAuthOpen(false);
  }

  function updateUser(next: SessionUser) {
    localStorage.setItem("express-user", JSON.stringify(next));
    setUser(next);
  }

  return (
    <AuthContext.Provider value={{ user, logout, openAuth, closeAuth, updateUser }}>
      {children}

      {checkingSession && <div className="session-check" role="status">Đang kiểm tra phiên đăng nhập…</div>}
      {sessionError && <div className="session-toast" role="status">{sessionError}</div>}

      {authOpen && (
        <AuthForm
          initialMode={authMode}
          onClose={closeAuth}
          onLoggedIn={(value) => {
            setSessionError("");
            updateUser(value);
            setAuthOpen(false);
          }}
        />
      )}
    </AuthContext.Provider>
  );
}

function AuthForm({
  initialMode,
  onClose,
  onLoggedIn,
}: {
  initialMode: AuthMode;
  onClose: () => void;
  onLoggedIn: (user: SessionUser) => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [forgot, setForgot] = useState(false);
  const [otpRequested, setOtpRequested] = useState(false);
  const [demoOtp, setDemoOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const inFlight = useRef(false);

  useEffect(() => {
    setMode(initialMode);
    setForgot(false);
    setOtpRequested(false);
    setDemoOtp("");
    setOtp("");
    setError("");
    setSuccess("");
  }, [initialMode]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(""), 4500);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(""), 4500);
    return () => window.clearTimeout(timer);
  }, [success]);

  function switchMode(next: AuthMode) {
    setMode(next);
    setForgot(false);
    setOtpRequested(false);
    setDemoOtp("");
    setOtp("");
    setError("");
    setSuccess("");
    setPassword("");
    setConfirmation("");
    setShowPassword(false);
  }

  function openForgot() {
    setForgot(true);
    setOtpRequested(false);
    setDemoOtp("");
    setOtp("");
    setPhone("");
    setPassword("");
    setConfirmation("");
    setError("");
    setSuccess("");
  }

  async function submitForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    const cleanPhone = phone.trim();
    if (!/^0[0-9]{9}$/.test(cleanPhone)) {
      setError("Số điện thoại phải gồm 10 số và bắt đầu bằng 0.");
      return;
    }

    if (otpRequested) {
      if (!/^[0-9]{6}$/.test(otp)) {
        setError("Mã OTP phải gồm 6 số.");
        return;
      }
      if (password.length < 8) {
        setError("Mật khẩu mới cần ít nhất 8 ký tự.");
        return;
      }
      if (password !== confirmation) {
        setError("Mật khẩu xác nhận chưa khớp.");
        return;
      }
    }

    inFlight.current = true;
    setBusy(true);
    setError("");
    setSuccess("");

    try {
      if (!otpRequested) {
        const result = await requestPasswordResetOtp(cleanPhone);
        setOtpRequested(true);
        setDemoOtp(result.demoOtp ?? "");
        setSuccess("Đã tạo mã OTP. Mã có hiệu lực trong 5 phút.");
      } else {
        const result = await resetPasswordByOtp({ phone: cleanPhone, otp, newPassword: password });
        setSuccess(result.message || "Đặt lại mật khẩu thành công.");
        setTimeout(() => switchMode("login"), 900);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thực hiện được yêu cầu.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    setError("");
    setSuccess("");

    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Email không hợp lệ.");
      return;
    }

    if (mode === "register") {
      if (!fullName.trim()) {
        setError("Vui lòng nhập họ và tên.");
        return;
      }
      if (!/^0[0-9]{9}$/.test(phone.trim())) {
        setError("Số điện thoại phải gồm 10 số và bắt đầu bằng 0.");
        return;
      }
      if (password.length < 8) {
        setError("Mật khẩu cần ít nhất 8 ký tự.");
        return;
      }
      if (password !== confirmation) {
        setError("Mật khẩu xác nhận chưa khớp.");
        return;
      }
    } else if (!password) {
      setError("Vui lòng nhập mật khẩu.");
      return;
    }

    inFlight.current = true;
    setBusy(true);

    try {
      if (mode === "register") {
        await api.register({ fullName, shopName, phone, email: cleanEmail, password });
        setPassword("");
        setConfirmation("");
        setShowPassword(false);
        setMode("login");
        setSuccess("Đăng ký thành công. Vui lòng đăng nhập bằng tài khoản vừa tạo.");
      } else {
        const nextUser = await api.login({ email: cleanEmail, password });
        setPassword("");
        onLoggedIn(nextUser);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thực hiện được yêu cầu.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const register = mode === "register";

  return (
    <div className="auth-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-label={forgot ? "Quên mật khẩu" : register ? "Đăng ký" : "Đăng nhập"}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <aside className="auth-story auth-story-modal">
          <div className="auth-wordmark"><span>E</span> express.</div>
          <div className="auth-story-body">
            <p className="auth-kicker">GỬI HÀNG AN TÂM</p>
            <h1>Từ cửa hàng bạn,<br />đến mọi hành trình.</h1>
            <p>Khách vãng lai có thể xem dịch vụ, chính sách, tra cứu và tạo đơn nhanh. Đăng nhập để quản lý đơn hàng, COD và tài khoản.</p>
          </div>
        </aside>

        <section className="auth-form-side auth-form-modal">
          <button className="auth-close" type="button" aria-label="Đóng" onClick={onClose}>×</button>
          <div className="auth-form-inner">
            <p className="eyebrow">CHÀO MỪNG ĐẾN EXPRESS</p>
            <h2>{forgot ? "Quên mật khẩu" : register ? "Đăng ký tài khoản" : "Đăng nhập"}</h2>
            <p className="muted">
              {forgot
                ? "Xác thực số điện thoại bằng OTP để đặt lại mật khẩu."
                : register
                  ? "Tạo tài khoản để quản lý hành trình giao hàng đầy đủ hơn."
                  : "Đăng nhập để quản lý đơn hàng, COD và thông tin tài khoản."}
            </p>

            {error && <div className="notice error" role="alert">{error}</div>}
            {success && <div className="notice success" role="status">{success}</div>}

            {forgot ? (
              <form className="auth-fields" onSubmit={submitForgot}>
                <label>Số điện thoại
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
                    inputMode="numeric"
                    maxLength={10}
                    disabled={otpRequested || busy}
                    required
                  />
                </label>

                {otpRequested && (
                  <>
                    {demoOtp && (
                      <div className="notice success" role="status">
                        <strong>OTP demo:</strong> {demoOtp}<br />
                        <small>Project chưa tích hợp dịch vụ SMS thật.</small>
                      </div>
                    )}
                    <label>Mã OTP
                      <input
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        inputMode="numeric"
                        maxLength={6}
                        required
                      />
                    </label>
                    <label>Mật khẩu mới
                      <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
                    </label>
                    <label>Nhập lại mật khẩu mới
                      <input type={showPassword ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} required />
                    </label>
                    <label className="auth-show-password checkbox">
                      <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
                      Hiện mật khẩu
                    </label>
                  </>
                )}

                <button className="primary auth-submit" type="submit" disabled={busy}>
                  {busy ? "Đang xử lý…" : otpRequested ? "Đặt lại mật khẩu" : "Gửi mã OTP"}
                </button>

                {otpRequested && (
                  <button
                    type="button"
                    className="auth-guest"
                    disabled={busy}
                    onClick={() => {
                      setOtpRequested(false);
                      setOtp("");
                      setDemoOtp("");
                      setError("");
                      setSuccess("");
                    }}
                  >
                    Gửi lại OTP / đổi số điện thoại
                  </button>
                )}
              </form>
            ) : (
              <form className="auth-fields" onSubmit={submit}>
                {register && (
                  <>
                    <label>Họ và tên
                      <input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={100} required />
                    </label>
                    <label>Tên cửa hàng (không bắt buộc)
                      <input value={shopName} onChange={(event) => setShopName(event.target.value)} maxLength={150} />
                    </label>
                    <label>Số điện thoại
                      <input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" maxLength={10} required />
                    </label>
                  </>
                )}

                <label>Email
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
                </label>

                <label>Mật khẩu
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={register ? "new-password" : "current-password"} required />
                </label>

                {register && (
                  <label>Nhập lại mật khẩu
                    <input type={showPassword ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required />
                  </label>
                )}

                <label className="auth-show-password checkbox">
                  <input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
                  Hiện mật khẩu
                </label>

                <button className="primary auth-submit" type="submit" disabled={busy}>
                  {busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập"}
                </button>
              </form>
            )}

            <div className="auth-links">
              {forgot ? (
                <button type="button" onClick={() => switchMode("login")}>Quay lại đăng nhập</button>
              ) : (
                <>
                  {!register && <button type="button" onClick={openForgot}>Quên mật khẩu?</button>}
                  <button type="button" onClick={() => switchMode(register ? "login" : "register")}>
                    {register ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
                  </button>
                </>
              )}
            </div>

            <button className="auth-guest" type="button" onClick={onClose}>Tiếp tục với tư cách khách</button>
          </div>
        </section>
      </div>
    </div>
  );
}
