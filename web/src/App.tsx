import { lazy, Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, money, STATUS, EVENT_STATUS } from "./api";
import type { PickupLocation, Quote, ServiceArea, Shipment, ShipmentInput } from "./api";
import "./App.css";
import IncidentPanel from "./IncidentPanel";
import StaffSprint2 from "./StaffSprint2";
import VnPayPanel from "./VnPayPanel";
import PaymentResultPage from "./PaymentResultPage";
import OperationsLayout from "./OperationsLayout";
import type { OperationsSection } from "./OperationsLayout";
import "./OperationsLayout.css";
import { paymentStatusApi } from "./lib/sprint2";
import WarehousePage from "./WarehousePage";
import IncidentManagement from "./IncidentManagement";
import ReportsPage from "./ReportsPage";
import PricingPage from "./PricingPage";
import PricingServicesPage from "./pages/PricingServices";
import PolicyFAQPage from "./pages/PolicyFAQ";
import { useAuth } from "./auth/context";
import type { UserRole } from "./api";
import DispatchPage from "./DispatchPage";
import SettlementsPage from "./SettlementsPage";
import MapLocationPicker from "./components/MapLocationPicker";
const OperationsRoutesPage = lazy(() => import("./pages/OperationsRoutesPage"));

type Page =
  | "home"
  | "dashboard"
  | "shipments"
  | "create"
  | "staff"
  | "warehouse"
  | "incidents"
  | "reports"
  | "pricing"
  | "pricing-services"
  | "support"
  | "dispatch"
  | "routes"
  | "settlements"
  | "account"
  | "payment-result";

const PATH_MAP: Record<Page, string> = {
  home: "/",
  dashboard: "/dashboard",
  shipments: "/shipments",
  create: "/orders/create",
  staff: "/staff",
  warehouse: "/warehouse",
  incidents: "/incidents",
  reports: "/reports",
  pricing: "/pricing",
  "pricing-services": "/pricing-services",
  support: "/support",
  dispatch: "/dispatch",
  routes: "/operations/routes",
  settlements: "/settlements",
  account: "/account",
  "payment-result": "/payment/result",
};

function getPageFromLocation(): Page | null {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase().replace(/^#\/?/, "");

  const matchCandidate = (val: string): Page | null => {
    if (val === "/" || val === "" || val === "home") {
      return "home";
    }

    if (val === "/payment/result" || val === "payment/result" || val === "payment-result") return "payment-result";
    if (val === "/account" || val === "account") {
      return "account";
    }
    if (val === "/pricing-services" || val === "pricing-services" || val === "price-list") return "pricing-services";
    if (val === "/support" || val === "support" || val === "/policy-faq" || val === "policy-faq") return "support";
    if (val === "/orders/create" || val === "orders/create" || val === "/create" || val === "create") return "create";
    if (val === "/shipments" || val === "shipments") return "shipments";
    if (val === "/settlements" || val === "settlements") return "settlements";
    if (val === "/reports" || val === "reports") return "reports";
    if (val === "/incidents" || val === "incidents") return "incidents";
    if (val === "/warehouse" || val === "warehouse") return "warehouse";
    if (val === "/staff" || val === "staff") return "staff";
    if (val === "/pricing" || val === "pricing") return "pricing";
    if (val === "/dispatch" || val === "dispatch") return "dispatch";
    if (val === "/operations/routes" || val === "operations/routes" || val === "routes") return "routes";
    if (val === "/dashboard" || val === "dashboard") return "dashboard";
    return null;
  };

  return matchCandidate(path) ?? matchCandidate(hash);
}

const PUBLIC_PAGES: Page[] = [
  "home",
  "create",
  "pricing-services",
  "support",
  "payment-result",
];

const ROLE_PAGES: Record<UserRole, Page[]> = {
  customer: [
    "dashboard",
    "shipments",
    "create",
    "pricing-services",
    "support",
    "settlements",
    "account",
  ],

  staff: [
    "staff",
    "account",
  ],

  operations: [
    "dashboard",
    "shipments",
    "staff",
    "warehouse",
    "incidents",
    "reports",
    "pricing",
    "pricing-services",
    "support",
    "dispatch",
    "routes",
    "settlements",
    "account",
  ],
};

type Notice = {
    kind: "success" | "error";
    text: string;
};
const emptyForm: ShipmentInput = {
    senderName: "",
    senderPhone: "",
    pickupAddress: "",
    pickupLatitude: undefined,
    pickupLongitude: undefined,
    recipientName: "",
    recipientPhone: "",
    deliveryAddress: "",
    deliveryLatitude: undefined,
    deliveryLongitude: undefined,
    goods: "",
    weightKg: 1,
    lengthCm: 20,
    widthCm: 15,
    heightCm: 10,
    declaredValue: 0,
    codAmount: 0,
    vehicleType: "motorbike",
    service: "standard",
    feePayer: "shop_prepaid",
    notes: "",
};
const textFields = [
    ["senderName", "Tên người gửi"],
    ["senderPhone", "Điện thoại người gửi"],
    ["pickupAddress", "Địa chỉ lấy hàng"],
    ["recipientName", "Tên người nhận"],
    ["recipientPhone", "Điện thoại người nhận"],
    ["deliveryAddress", "Địa chỉ giao hàng"],
    ["goods", "Nội dung hàng hóa"],
] as const;
const numberFields = [
    ["weightKg", "Khối lượng (kg)", 0.01, "0.01"],
    ["lengthCm", "Chiều dài (cm)", 0.1, "0.1"],
    ["widthCm", "Chiều rộng (cm)", 0.1, "0.1"],
    ["heightCm", "Chiều cao (cm)", 0.1, "0.1"],
    ["declaredValue", "Giá trị hàng (đ)", 0, "1"],
    ["codAmount", "Tiền thu hộ COD (đ)", 0, "1"],
] as const;
function Badge({ shipment }: {
    shipment: Shipment;
}) {
    return (<span className={`badge ${shipment.status}`}>
      {STATUS[shipment.status]}
    </span>);
}
  export default function App() {
    const { user, logout } = useAuth();
    const [paymentStatuses, setPaymentStatuses] = useState<Record<string, string>>({});

    const normalizedRole: UserRole | null = user
      ? (user.role as string) === "shop"
        ? "customer"
        : user.role
      : null;

    const allowedPages: Page[] = normalizedRole === "staff"
      ? ROLE_PAGES.staff
      : normalizedRole === "operations"
        ? ROLE_PAGES.operations
        : normalizedRole
          ? Array.from(new Set([...PUBLIC_PAGES, ...ROLE_PAGES[normalizedRole]]))
          : PUBLIC_PAGES;

        const [page, setPage] = useState<Page>(() => {
      const initialFromUrl =
        getPageFromLocation();

      if (
        initialFromUrl &&
        allowedPages.includes(initialFromUrl)
      ) {
        return initialFromUrl;
      }

      if (!user) {
        return "home";
      }

      return normalizedRole === "staff"
        ? "staff"
        : normalizedRole === "operations" ? "shipments" : "dashboard";
    });

      useEffect(() => {
        // VNPay Return URL tải lại trang: giữ đường dẫn kết quả trong khi khôi phục JWT.
        if (getPageFromLocation() === "payment-result") {
          setPage("payment-result");
          return;
        }
        if (!user) {
          setPage("home");
          return;
        }
        setPage((current) => {
          if (!allowedPages.includes(current) || current === "home") {
            return normalizedRole === "staff" ? "staff" : normalizedRole === "operations" ? "shipments" : "dashboard";
          }
          return current;
        });
      }, [user, normalizedRole]);

    const navigate = (target: Page | string) => {
        let targetPage: Page = "home";

        if (target === "/" || target === "home") {
          targetPage = "home";
        } else if (target === "/payment/result" || target === "payment-result") {
          targetPage = "payment-result";
        } else if (target === "/account" || target === "account") {
          targetPage = "account";
        } else if (
          target === "/pricing-services" ||
          target === "pricing-services" ||
          target === "price-list"
        ) {
          targetPage = "pricing-services";
        } else if (
          target === "/support" ||
          target === "/policy-faq" ||
          target === "support" ||
          target === "policy-faq"
        ) {
          targetPage = "support";
        } else if (
          target === "/orders/create" ||
          target === "/create" ||
          target === "create"
        ) {
          targetPage = "create";
        } else if (target in PATH_MAP) {
          targetPage = target as Page;
        }

        if (!allowedPages.includes(targetPage)) {
          setNotice({
            kind: "error",
            text: user ? "Bạn không có quyền truy cập chức năng này." : "Bạn cần đăng nhập để sử dụng chức năng này.",
          });
          return;
        }

        setPage(targetPage);

        const targetPath = PATH_MAP[targetPage];

        if (window.location.pathname !== targetPath) {
          window.history.pushState(null, "", targetPath);
        }
      };

      const requestAuth = (
        mode: "login" | "register" = "login",
      ) => {
        window.dispatchEvent(
          new CustomEvent("express:auth-request", {
            detail: { mode },
          }),
        );
      };

    useEffect(() => {
      const onPopState = () => {
        const fromUrl = getPageFromLocation();
        if (fromUrl && allowedPages.includes(fromUrl)) {
          setPage(fromUrl);
        }
      };
      window.addEventListener("popstate", onPopState);
      return () => window.removeEventListener("popstate", onPopState);
    }, [allowedPages]);

    useEffect(() => {
      if (page === "create") {
        const stored = sessionStorage.getItem("express_selected_service");
        if (stored === "express" || stored === "standard") {
          setForm((current) => ({ ...current, service: stored }));
          sessionStorage.removeItem("express_selected_service");
        }
      }
    }, [page]);

    const [signingOut, setSigningOut] = useState(false);

    const canCreateOrders = allowedPages.includes("create");

    const [shipments, setShipments] = useState<Shipment[]>([]);
    const [form, setForm] = useState<ShipmentInput>(emptyForm);
    const [quote, setQuote] = useState<Quote | null>(null);
    const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
    const [areasLoading, setAreasLoading] = useState(false);
    const [areasError, setAreasError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    
    
    const [notice, setNotice] = useState<Notice | null>(null);
    async function handleLogout() {
      if (signingOut) return;
      setSigningOut(true);
      try {
        await logout();
        // Avoid role-based navigate() while React is still rendering the old role.
        setPage("home");
        setSelectedId(null);
        window.history.replaceState(null, "", "/");
      } catch (error) {
        setNotice({
          kind: "error",
          text: error instanceof Error ? error.message : "Không đăng xuất được.",
        });
      } finally {
        setSigningOut(false);
      }
    }


    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [trackingCode, setTrackingCode] = useState("");
    const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
    const [pickupName, setPickupName] = useState("");

    // AreaId is chosen from the backend catalog, not inferred from map/address text.
    useEffect(() => {
      if (page !== "create" || !user) {
        setServiceAreas([]);
        setAreasLoading(false);
        setAreasError("");
        return;
      }
      let active = true;
      setAreasLoading(true);
      setAreasError("");
      api.listAreas()
        .then((areas) => { if (active) setServiceAreas(areas); })
        .catch((error: unknown) => {
          if (active) {
            setServiceAreas([]);
            setAreasError(error instanceof Error ? error.message : "Không tải được danh mục phường/xã.");
          }
        })
        .finally(() => { if (active) setAreasLoading(false); });
      return () => { active = false; };
    }, [page, user?.id]);
    const [pickupLoading, setPickupLoading] =
      useState(user?.role === "customer");
      useEffect(() => {
        if (!user) {
          setShipments([]);
          setLoading(false);
          return;
        }

        let active = true;

        setLoading(true);

        api.list()
          .then((data) => {
            if (active) {
              setShipments(data);
            }
          })
          .catch((error: unknown) => {
            if (active) {
              setNotice({
                kind: "error",
                text:
                  error instanceof Error
                    ? error.message
                    : "Không tải được dữ liệu.",
              });
            }
          })
          .finally(() => {
            if (active) {
              setLoading(false);
            }
          });

        return () => {
          active = false;
        };
      }, [user]);
      
      useEffect(() => {
        if (!user || user.role !== "customer") {
          setPickupLocations([]);
          setPickupLoading(false);
          return;
        }

        let active = true;

        setPickupLoading(true);

        api.listPickupLocations()
          .then((locations) => {
            if (active) {
              setPickupLocations(locations);
            }
          })
          .catch((error: unknown) => {
            if (active) {
              setNotice({
                kind: "error",
                text:
                  error instanceof Error
                    ? error.message
                    : "Không tải được điểm lấy hàng.",
              });
            }
          })
          .finally(() => {
            if (active) {
              setPickupLoading(false);
            }
          });

        return () => {
          active = false;
        };
      }, [user]);

    useEffect(() => {
      if (!user || normalizedRole !== "customer" || page !== "shipments") return;
      let alive = true;
      const refresh = async () => {
        try {
          const rows = await paymentStatusApi.list();
          if (alive) setPaymentStatuses(Object.fromEntries(rows.map((r) => [r.shipmentId, r.status])));
        } catch (error) {
          console.error("Không thể tải trạng thái thanh toán:", error);
        }
      };
      void refresh();
      const timer = window.setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 15000);
      const focus = () => { void refresh(); };
      window.addEventListener("focus", focus);
      return () => {
        alive = false;
        window.clearInterval(timer);
        window.removeEventListener("focus", focus);
      };
    }, [user?.id, normalizedRole, page]);

    useEffect(() => {
      if (!user || normalizedRole !== "operations" || page !== "shipments") return;
      let alive = true;
      const refresh = async () => {
        try {
          const rows = await api.list();
          if (alive) setShipments(rows);
        } catch (error) {
          console.error("Không thể làm mới đơn Operations:", error);
        }
      };
      void refresh();
      const timer = window.setInterval(() => { if (document.visibilityState !== "hidden") void refresh(); }, 15000);
      const focus = () => { void refresh(); };
      window.addEventListener("focus", focus);
      return () => {
        alive = false;
        window.clearInterval(timer);
        window.removeEventListener("focus", focus);
      };
    }, [user?.id, normalizedRole, page]);
    function handleTracking(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSelectedId(null);
        void run(async () => {
            const shipment = await api.getShipment(trackingCode);
            // Keep the latest response so the existing detail panel can display it.
            setShipments((current) => {
                const exists = current.some((item) => item.id === shipment.id);
                return exists
                    ? current.map((item) => item.id === shipment.id ? shipment : item)
                    : [shipment, ...current];
            });
            openShipment(shipment);
        });
    }
    async function run(action: () => Promise<void>) {
        setBusy(true);
        setNotice(null);
        try {
            await action();
        }
        catch (error) {
            setNotice({
                kind: "error",
                text: error instanceof Error ? error.message : "Đã xảy ra lỗi.",
            });
        }
        finally {
            setBusy(false);
        }
    }
    function savePickupLocation() {
        void run(async () => {
            const location = await api.createPickupLocation({
                name: pickupName,
                contactName: form.senderName,
                contactPhone: form.senderPhone,
                address: form.pickupAddress,
            });
            setPickupLocations((current) => [...current, location]);
            setPickupName("");
            setNotice({
                kind: "success",
                text: `Đã lưu điểm lấy hàng "${location.name}".`,
            });
        });
    }
    function update<K extends keyof ShipmentInput>(key: K, value: ShipmentInput[K]) {
        setForm((current) => {
            const next = { ...current, [key]: value };
            if (key === "pickupAddress") {
                next.pickupLatitude = undefined;
                next.pickupLongitude = undefined;
            } else if (key === "deliveryAddress") {
                next.deliveryLatitude = undefined;
                next.deliveryLongitude = undefined;
            }
            return next;
        });
        setQuote(null);
    }
    function openShipment(shipment: Shipment) {
        setSelectedId(shipment.id);
        
        
    }
    function submitQuote(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (user && !form.deliveryAreaId) {
            setNotice({ kind: "error", text: "Vui lòng chọn phường/xã giao hàng để hệ thống tự phân công Staff." });
            return;
        }
        if (form.pickupLatitude == null || form.pickupLongitude == null ||
            form.deliveryLatitude == null || form.deliveryLongitude == null) {
            setNotice({ kind: "error", text: "Vui lòng chọn cả hai vị trí trên bản đồ trước khi báo giá." });
            return;
        }
        void run(async () => setQuote(await api.quote(form)));
    }
    const selected = shipments.find((item) => item.id === selectedId);
    const filtered = shipments.filter((item) => {
        const term = search.trim().toLocaleLowerCase("vi");
        const matchesSearch = [
            item.id,
            item.recipientName,
            item.recipientPhone,
        ].some((value) => value.toLocaleLowerCase("vi").includes(term));
        return matchesSearch && (!statusFilter || item.status === statusFilter);
    });
    const delivered = shipments.filter((item) => item.status === "delivered");
    const active = shipments.filter((item) => !["delivered", "return_confirmed"].includes(item.status));
    const failed = shipments.filter((item) => ["pickup_failed", "delivery_failed"].includes(item.status));
    const collected = shipments.reduce((sum, shipment) => sum + shipment.codCollected, 0);
    const titles: Record<Page, string> = {
      home: "Express Delivery",
      dashboard: "Tổng quan vận chuyển",
      shipments: "Quản lý đơn hàng",
      create: user ? "Tạo đơn giao hàng" : "Tạo đơn nhanh",
      staff: "Công việc giao nhận",
      warehouse: "Quản lý kho và trung chuyển",
      incidents: "Quản lý sự cố và khiếu nại",
      reports: "Báo cáo hoạt động",
      pricing: "Cấu hình bảng giá",
      "pricing-services": "Bảng giá & Dịch vụ",
      support: "Trung tâm hỗ trợ & Chính sách",
      dispatch: "Điều phối giao nhận",
      routes: "Quản lý tuyến giao hàng",
      settlements: "Đối soát COD",
      account: "Tài khoản của tôi",
      "payment-result": "Kết quả thanh toán VNPay",
    };
    const renderContent = (<>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                  {user
                    ? "EXPRESS / WORKSPACE"
                    : "EXPRESS / DELIVERY"}
                </p>

                <h1>{titles[page]}</h1>

                <p className="muted">
                  {user
                    ? "Quản lý hành trình giao hàng của bạn."
                    : "Gửi hàng, tra cứu và tìm hiểu dịch vụ Express."}
                </p>
            </div>
            {canCreateOrders && page !== "create" && (<button className="primary" onClick={() => navigate("create")}>
                + Tạo đơn hàng
              </button>)}
          </div>

          {notice && (<div className={`notice ${notice.kind}`} role="status">
              {notice.text}
            </div>)}

            {page === "payment-result" && <PaymentResultPage onNavigate={navigate} />}
            {page === "home" && (
  <>
              <section className="hero">
                <div>
                  <span className="hero-label">
                    GIAO HÀNG DỄ DÀNG HƠN
                  </span>

                  <h2>
                    Gửi hàng nhanh chóng,
                    <br />
                    đơn giản và minh bạch.
                  </h2>

                  <p>
                    Tạo đơn nhanh, tra cứu vận đơn,
                    xem bảng giá và chính sách mà
                    không cần đăng nhập.
                  </p>

                  <div className="actions">
                    <button
                      className="primary"
                      onClick={() => navigate("create")}
                    >
                      Tạo đơn nhanh →
                    </button>

                    <button
                      onClick={() =>
                        navigate("pricing-services")
                      }
                    >
                      Xem bảng giá
                    </button>

                    {!user && (
                      <button
                        onClick={() => requestAuth("login")}
                      >
                        Đăng nhập
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className="parcel-art"
                  aria-hidden="true"
                >
                  <div className="parcel">
                    E<span>EXPRESS</span>
                  </div>

                  <span className="parcel-caption">
                    Đóng gói niềm tin.
                  </span>
                </div>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">
                      KHÁCH VÃNG LAI
                    </p>

                    <h2>
                      Không cần tài khoản để bắt đầu
                    </h2>

                    <p className="muted">
                      Bạn vẫn có thể tạo đơn nhanh,
                      tra cứu vận đơn, xem dịch vụ và
                      chính sách của Express.
                    </p>
                  </div>
                </div>

                <div className="stats">
                  <article
                    className="stat"
                    onClick={() => navigate("create")}
                  >
                    <p>Tạo đơn nhanh</p>
                    <strong>Gửi hàng →</strong>
                  </article>

                  <article
                    className="stat"
                    onClick={() =>
                      navigate("pricing-services")
                    }
                  >
                    <p>Dịch vụ</p>
                    <strong>Xem bảng giá →</strong>
                  </article>

                  <article
                    className="stat"
                    onClick={() => navigate("support")}
                  >
                    <p>Chính sách</p>
                    <strong>FAQ & Bảo mật →</strong>
                  </article>
                </div>
              </section>

              <section
                id="quick-actions"
                className="panel"
              >
                <div className="panel-heading">
                  <div>
                    <h2>Tra cứu vận đơn</h2>

                    <p className="muted">
                      Nhập mã vận đơn để theo dõi
                      trạng thái giao hàng.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={handleTracking}
                  className="tracking-search"
                >
                  <label htmlFor="public-tracking-code">
                    Mã vận đơn

                    <input
                      id="public-tracking-code"
                      placeholder="Ví dụ: EXP-..."
                      value={trackingCode}
                      onChange={(event) =>
                        setTrackingCode(
                          event.target.value,
                        )
                      }
                      required
                      disabled={busy}
                    />
                  </label>

                  <button
                    type="submit"
                    className="primary"
                    disabled={
                      busy ||
                      !trackingCode.trim()
                    }
                  >
                    {busy
                      ? "Đang tra cứu…"
                      : "Tra cứu"}
                  </button>
                </form>
              </section>
            </>
          )}
          {(page === "dashboard" || page === "shipments") && (<section id="quick-actions" className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Tra cứu vận đơn</h2>
                  <p className="muted">
                    Nhập mã vận đơn để xem trạng thái và lịch sử giao hàng.
                  </p>
                </div>
              </div>

              <form onSubmit={handleTracking} className="tracking-search">
                <label htmlFor="tracking-code">
                  Mã vận đơn
                  <input id="tracking-code" placeholder="Ví dụ: EXP-DEMO-001" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} required disabled={busy} spellCheck={false}/>
                </label>

                <button type="submit" className="primary" disabled={busy || !trackingCode.trim()}>
                  {busy ? "Đang tra cứu…" : "Tra cứu"}
                </button>
              </form>
            </section>)}
          {page === "dashboard" && (<>
              <section className="hero">
                <div>
                  <span className="hero-label">GIAO HÀNG DỄ DÀNG HƠN</span>
                  <h2>Từ cửa hàng của bạn,<br />đến tay khách hàng.</h2>
                  <p>Tạo đơn, kiểm tra tiến trình và theo dõi COD.</p>
                  {canCreateOrders && (<button onClick={() => navigate("create")}>
                      Bắt đầu gửi hàng →
                    </button>)}
                </div>
                <div className="parcel-art" aria-hidden="true">
                  <div className="parcel">E<span>EXPRESS</span></div>
                  <span className="parcel-caption">Đóng gói niềm tin.</span>
                </div>
              </section>

              <section id="stats" className="stats" aria-label="Thống kê đơn hàng">
                {[
                ["Tổng đơn hàng", loading ? "—" : shipments.length],
                ["Đang xử lý", loading ? "—" : active.length],
                ["Giao thành công", loading ? "—" : delivered.length],
                ["COD đã thu", loading ? "—" : money(collected)],
            ].map(([label, value]) => (<article className="stat" key={label}>
                    <p>{label}</p><strong>{value}</strong>
                  </article>))}
              </section>

              <div className="hint">
                {failed.length} đơn cần xử lý sau lần lấy/giao thất bại.
                COD đã thu chưa đồng nghĩa với số tiền đã đối soát hoặc thanh toán.
              </div>
            </>)}

          {page === "create" ? (<form onSubmit={submitQuote} className="panel">
              <div className="panel-heading">
                <h2>Thông tin vận đơn</h2>
                <span className="muted">Xem phí trước khi xác nhận</span>
              </div>

              <fieldset disabled={busy}>
                <div className="pickup-box">
                  <h3>Điểm lấy hàng đã lưu</h3>

                  <label>
                    Chọn điểm lấy hàng
                    <select defaultValue="" disabled={pickupLoading || pickupLocations.length === 0} onChange={(event) => {
                const location = pickupLocations.find((item) => item.id === event.target.value);
                if (location) {
                    setForm((current) => ({
                        ...current,
                        senderName: location.contactName,
                        senderPhone: location.contactPhone,
                        pickupAddress: location.address,
                        pickupLatitude: undefined,
                        pickupLongitude: undefined,
                    }));
                    // A different pickup address may change the shipping fee.
                    setQuote(null);
                }
                // Reset the selector so the same saved location can be reused.
                event.currentTarget.value = "";
            }}>
                      <option value="" disabled>
                        {pickupLoading
                ? "Đang tải điểm lấy hàng…"
                : pickupLocations.length === 0
                    ? "Chưa có điểm lấy hàng — nhập thông tin bên dưới"
                    : "Chọn để điền thông tin người gửi"}
                      </option>

                      {pickupLocations.map((location) => (<option key={location.id} value={location.id}>
                          {location.name} — {location.address}
                        </option>))}
                    </select>
                  </label>

                  <div className="pickup-save">
                    <label>
                      Tên điểm lấy hàng mới
                      <input placeholder="Ví dụ: Cửa hàng Quận 1" value={pickupName} maxLength={100} onChange={(event) => setPickupName(event.target.value)}/>
                    </label>

                    <button type="button" disabled={pickupLoading || !pickupName.trim()} onClick={savePickupLocation}>
                      Lưu điểm lấy hàng
                    </button>
                  </div>

                  <p className="muted">
                    Nhập tên người gửi, điện thoại và địa chỉ lấy hàng ở bên dưới,
                    sau đó bấm lưu để sử dụng cho những đơn tiếp theo.
                  </p>
                </div>
                <div className="form-grid">
                  {textFields.map(([key, label]) => (<label key={key}>
                      {label}
                      <input required maxLength={300} type={key.endsWith("Phone") ? "tel" : "text"} value={form[key]} onChange={(event) => update(key, event.target.value)}/>
                    </label>))}

                  <label>
                    Phường/xã lấy hàng (không bắt buộc)
                    <select value={form.pickupAreaId ?? ""} disabled={!user || areasLoading || !!areasError}
                      onChange={(event) => update("pickupAreaId", event.target.value ? Number(event.target.value) : undefined)}>
                      <option value="">Chọn khu vực lấy hàng</option>
                      {serviceAreas.map((area) => <option key={area.id} value={area.id}>{area.name} ({area.code})</option>)}
                    </select>
                  </label>
                  <label>
                    Phường/xã giao hàng {user ? "(bắt buộc)" : ""}
                    <select required={!!user} value={form.deliveryAreaId ?? ""} disabled={!user || areasLoading || !!areasError}
                      onChange={(event) => update("deliveryAreaId", event.target.value ? Number(event.target.value) : undefined)}>
                      <option value="">{areasLoading ? "Đang tải khu vực…" : "Chọn khu vực giao hàng"}</option>
                      {serviceAreas.map((area) => <option key={area.id} value={area.id}>{area.name} ({area.code})</option>)}
                    </select>
                  </label>
                  <p className="muted full">
                    {areasError || (!user
                      ? "Đăng nhập để chọn phường/xã và kích hoạt tự động phân công Staff."
                      : "Khu vực giao hàng quyết định Staff tự động được phân công; vị trí bản đồ dùng để xác định địa điểm.")}
                  </p>

                  <div className="full">
                      <MapLocationPicker
                        label="Chọn vị trí lấy hàng"
                        address={form.pickupAddress}
                        value={
                          form.pickupLatitude != null && form.pickupLongitude != null
                            ? {
                                latitude: form.pickupLatitude,
                                longitude: form.pickupLongitude,
                              }
                            : null
                        }
                        onChange={(coordinate) => {
                          setForm((current) => ({
                            ...current,
                            pickupLatitude: coordinate.latitude,
                            pickupLongitude: coordinate.longitude,
                          }));

                          setQuote(null);
                        }}
                        />
                    </div>

                    <div className="full">
                      <MapLocationPicker
                        label="Chọn vị trí giao hàng"
                        address={form.deliveryAddress}
                        color="#16834a"
                        value={
                          form.deliveryLatitude != null && form.deliveryLongitude != null
                            ? {
                                latitude: form.deliveryLatitude,
                                longitude: form.deliveryLongitude,
                              }
                            : null
                        }
                        onChange={(coordinate) => {
                          setForm((current) => ({
                            ...current,
                            deliveryLatitude: coordinate.latitude,
                            deliveryLongitude: coordinate.longitude,
                          }));

                          setQuote(null);
                        }}
                      />
                    </div>
                  {numberFields.map(([key, label, min, step]) => (<label key={key}>
                      {label}
                      <input required type="number" min={min} step={step} value={form[key]} onChange={(event) => update(key, event.target.valueAsNumber)}/>
                    </label>))}

                    <label>
                        Phương tiện

                <select
                  value={form.vehicleType}
                  onChange={(event) => {
                    const vehicleType =
                      event.target.value as ShipmentInput["vehicleType"];

                    setForm((current) => {
                      const nextService =
                        vehicleType === "car" &&
                        current.service === "express"
                          ? "fast"
                          : current.service;

                      return {
                        ...current,
                        vehicleType,
                        service: nextService,
                      };
                    });

                    setQuote(null);
                  }}
                >
                  <option value="motorbike">
                    Xe máy
                  </option>

                  <option value="car">
                    Ô tô
                  </option>
                </select>
              </label>

                    <label>
                  Dịch vụ

                  <select
                    value={form.service}
                    onChange={(event) =>
                      update(
                        "service",
                        event.target.value as ShipmentInput["service"],
                      )
                    }
                  >
                    <option value="standard">Tiêu chuẩn</option>
                    <option value="fast">Giao nhanh</option>

                    {form.vehicleType === "motorbike" && (
                      <option value="express">Hỏa tốc</option>
                    )}
                  </select>
                </label>

                  <label>
                    Thanh toán phí vận chuyển
                    <select value={form.feePayer} onChange={(event) => update("feePayer", event.target.value as ShipmentInput["feePayer"])}>
                      <option value="shop_prepaid">Shop trả trước</option>
                      <option value="recipient">Người nhận trả</option>
                      <option value="deduct_cod">Khấu trừ COD</option>
                    </select>
                  </label>

                  <label className="full">
                    Ghi chú giao hàng
                    <textarea rows={3} maxLength={1000} value={form.notes} onChange={(event) => update("notes", event.target.value)}/>
                  </label>
                </div>

                <div className="form-footer">
                  <div>
                    <strong>
                      {quote ? money(quote.fee) : "Chưa tính phí vận chuyển"}
                    </strong>
                    <p className="muted">
                      {"Phí được cung cấp bởi hệ thống."}
                    </p>
                  </div>

                  <div className="actions">
                    <button type="submit">
                      {busy ? "Đang xử lý…" : "Tính phí"}
                    </button>

                    {quote && (<button type="button" className="primary" onClick={() => void run(async () => {
                    const shipment =
                      await api.create(form, quote.id);

                    setShipments((current) => [
                      shipment,
                      ...current,
                    ]);

                    setForm({ ...emptyForm });
                    setQuote(null);

                    if (user) {
                      navigate("shipments");

                      setNotice({
                        kind: "success",
                        text: `Đã tạo đơn ${shipment.id}`,
                      });
                    } else {
                      setTrackingCode(shipment.id);
                      navigate("home");

                      setNotice({
                        kind: "success",
                        text:
                          `Đã tạo đơn ${shipment.id}. ` +
                          "Hãy lưu mã vận đơn để tra cứu.",
                      });
                    }
                })}>
                        Xác nhận tạo đơn
                      </button>)}
                  </div>
                </div>
              </fieldset>
              </form>) : page === "staff" ? (<StaffSprint2 />) : page === "warehouse" ? (<WarehousePage shipments={shipments} loading={loading} onShipmentUpdated={(updated) => {
                setShipments((current) => current.map((shipment) => shipment.id === updated.id ? updated : shipment));
            }}/>) : page === "incidents" ? (<IncidentManagement />) : page === "reports" ? (<ReportsPage />) : page === "pricing" ? (<PricingPage />) : page === "pricing-services" ? (<PricingServicesPage onNavigate={navigate} />) : page === "support" ? (<PolicyFAQPage />) : page === "dispatch" ? (<DispatchPage shipments={shipments} loading={loading} onShipmentUpdated={(updated) => {
                setShipments((current) => current.map((shipment) => shipment.id === updated.id ? updated : shipment));
            }}/>) : page === "routes" ? (<Suspense fallback={<section className="panel"><p role="status">Đang tải quản lý tuyến…</p></section>}><OperationsRoutesPage /></Suspense>) : page === "settlements" ? (<SettlementsPage />) : page === "payment-result" ? null : page === "account" ? (
              <section className="panel"><h2>Tài khoản</h2><p>Thông tin tài khoản: {user?.name ?? "Khách"}</p></section>
            ) : (<section className="panel">
              <div className="panel-heading">
                <h2>{page === "dashboard" ? "Đơn hàng gần đây" : "Danh sách đơn hàng"}</h2>
                <span className="muted">{filtered.length} đơn</span>
              </div>

              <div className="filters">
                <input aria-label="Tìm đơn hàng" placeholder="Tìm mã vận đơn, tên hoặc số điện thoại…" value={search} onChange={(event) => setSearch(event.target.value)}/>
                <select aria-label="Lọc theo trạng thái" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">Tất cả trạng thái</option>
                  {Object.entries(STATUS).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
                </select>
              </div>

              {loading ? (<p role="status">Đang tải đơn hàng…</p>) : filtered.length === 0 ? (<div className="empty">
                  <h3>Không có đơn hàng phù hợp</h3>
                  <p>Thử từ khóa khác hoặc tạo đơn hàng đầu tiên.</p>
                </div>) : (<div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Mã vận đơn</th>
                        <th>Người nhận</th>
                        <th>Trạng thái</th>
                        <th>Thanh toán</th>
                        <th>COD</th>
                        <th>Phí giao</th>
                        <th>Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, page === "dashboard" ? 5 : filtered.length)
                    .map((shipment) => (<tr key={shipment.id}>
                            <td>
                              <strong className="tracking-code">{shipment.id}</strong>
                              <small>
                                {new Date(shipment.createdAt).toLocaleDateString("vi-VN")}
                              </small>
                            </td>
                            <td>
                              {shipment.recipientName}
                              <small>{shipment.recipientPhone}</small>
                            </td>
                            <td><Badge shipment={shipment}/></td>
                            <td>{normalizedRole === "operations"
                                ? "Chưa có API thanh toán cho Operations"
                                : shipment.feePayer !== "shop_prepaid"
                                  ? "Thu phí theo hình thức khác"
                                  : paymentStatuses[shipment.id] === "paid"
                                    ? "Đã thanh toán"
                                    : paymentStatuses[shipment.id] === "pending"
                                      ? "Chờ thanh toán"
                                      : paymentStatuses[shipment.id] === "failed"
                                        ? "Thanh toán thất bại"
                                        : "Chưa thanh toán"}</td>
                            <td>{money(shipment.codAmount)}</td>
                            <td>{money(shipment.fee)}</td>
                            <td>
                              <button onClick={() => openShipment(shipment)}>
                                Theo dõi →
                              </button>
                            </td>
                          </tr>))}
                    </tbody>
                  </table>
                </div>)}
            </section>)}

          {selected && (page === "dashboard" || page === "shipments") && (<section className="panel tracking" aria-label="Chi tiết vận đơn">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">CHI TIẾT HÀNH TRÌNH</p>
                  <h2 className="tracking-code">{selected.id}</h2>
                </div>
                <button onClick={() => setSelectedId(null)}>Đóng</button>
              </div>

              <div className="route">
                <div><small>LẤY HÀNG</small><p>{selected.pickupAddress}</p></div>
                <span aria-hidden="true">→</span>
                <div><small>GIAO HÀNG</small><p>{selected.deliveryAddress}</p></div>
              </div>

              <p className="muted">
                {selected.goods} · {selected.weightKg} kg ·
                Số lần giao: {selected.attempts} ·
                COD đã thu: {money(selected.codCollected)}
              </p>

              <ol className="timeline">
                {selected.events.map((event, index) => (<li key={`${event.at}-${index}`}>
                    <strong>{EVENT_STATUS[event.status] || event.status}</strong>
                    <time>{new Date(event.at).toLocaleString("vi-VN")}</time>
                    {event.note && <p>{event.note}</p>}
                  </li>))}
              </ol>
              
              <IncidentPanel key={selected.id} shipmentId={selected.id}/>
              {normalizedRole === "customer" && (
                <VnPayPanel key={selected.id} shipmentId={selected.id} feePayer={selected.feePayer} />
              )}

              {null}
            </section>)}
    </>);
    const operationsSection: OperationsSection =
      page === "settlements" ? "settlements" : page === "routes" ? "routes" : "orders";
    if (normalizedRole === "operations") {
      return (
        <OperationsLayout
          section={operationsSection}
          onSectionChange={(section) => navigate(section === "orders" ? "shipments" : section === "routes" ? "routes" : "settlements")}
          userName={user?.name ?? "Operations"}
          signingOut={signingOut}
          onLogout={() => { void handleLogout(); }}
        >
          {(page === "shipments" || page === "dispatch") && (
            <div className="operations-order-tabs" style={{display:"flex", gap:12, margin:"12px 18px"}}>
              <button type="button" onClick={() => navigate("shipments")}
                aria-current={page === "shipments" ? "page" : undefined}>Danh sách đơn</button>
              <button type="button" onClick={() => navigate("dispatch")}
                aria-current={page === "dispatch" ? "page" : undefined}>Phân công / Điều phối</button>
            </div>
          )}
          {renderContent}
        </OperationsLayout>
      );
    }
    return (<div className="app">
      <aside className="sidebar">
        <a
            className="brand"
            href="/"
            onClick={(event) => {
              event.preventDefault();

              if (!user) {
                navigate("home");
              } else {
                navigate(
                  user.role === "staff"
                    ? "staff"
                    : "dashboard",
                );
              }
            }}
          >
            <span className="brand-icon">E</span>
            express<span className="brand-dot">.</span>
        </a>

        <p className="nav-caption">
          {normalizedRole === "staff" ? "STAFF / GIAO NHẬN" : user ? "KHÔNG GIAN LÀM VIỆC" : "KHÁM PHÁ EXPRESS"}
        </p>

        <nav aria-label="Điều hướng chính">
          {(normalizedRole === "staff" ? ([
              ["staff", "⌂", "Trang chủ Staff"],
              ["account", "◎", "Tài khoản"],
            ] as const) : ([
              ["home", "⌂", "Trang chủ"],
              ["dashboard", "◫", "Tổng quan"],
              ["shipments", "▤", "Đơn hàng"],
              ["create", "+", user ? "Tạo đơn mới" : "Tạo đơn nhanh"],
              ["staff", "↗", "Việc giao nhận"],
              ["warehouse", "▣", "Kho & trung chuyển"],
              ["incidents", "!", "Xử lý sự cố"],
              ["reports", "▥", "Báo cáo"],
              ["pricing", "₫", "Cấu hình giá"],
              ["pricing-services", "≣", "Bảng giá & Dịch vụ"],
              ["support", "?", "Chính sách & FAQ"],
              ["dispatch", "↔", "Điều phối"],
              ["settlements", "₫", "Đối soát COD"],
              ["account", "◎", "Tài khoản"],
            ] as const))
            .filter(([key]) => allowedPages.includes(key))
            .map(([key, icon, label]) => {
              const isActive = page === key;
              return (
                <button
                  key={key}
                  className={isActive ? "nav active" : "nav"}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => navigate(key)}
                >
                  <span aria-hidden="true">{icon}</span>{label}
                </button>
              );
            })}
        </nav>

        <div className="sidebar-note">
          <strong>Mỗi đơn hàng, một hành trình.</strong>
          <p>Theo dõi vận chuyển tại một nơi.</p>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <span>Cổng quản lý giao hàng</span>

          <div className="account-controls">
                {user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate("account")}
                    >
                      {user.name}
                    </button>

                    <span className="environment">
                      ● Kết nối API
                    </span>

                    <button
                      type="button"
                      disabled={signingOut}
                      onClick={() => { void handleLogout(); }}
                    >
                      {signingOut
                        ? "Đang thoát…"
                        : "Đăng xuất"}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="environment">
                      ● Khách vãng lai
                    </span>

                    <button
                    type="button"
                    className="primary"
                    onClick={() => requestAuth("login")}
                  >
                    Đăng nhập
                  </button>
                  </>
                  )}
              </div>
        </header>

        <div className="content">
          {renderContent}
        </div>
      </main>
    </div>);
}
