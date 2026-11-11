import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, money } from "./api";
import type { Settlement, SettlementData } from "./api";
import { useAuth } from "./auth/context";
export default function SettlementsPage() {
    const { user } = useAuth();
    const canManage = user?.role === "operations";
    const [data, setData] = useState<SettlementData | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [reload, setReload] = useState(0);
    const [adjustment, setAdjustment] = useState(0);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    // Never silently settle every eligible shipment. Operations must explicitly
    // choose the same Shop's shipments for each settlement batch.
    const [chosenShipmentIds, setChosenShipmentIds] = useState<string[]>([]);
    useEffect(() => {
        let active = true;
        setLoading(true);
        setLoadError("");
        api.getSettlementData()
            .then((result) => {
            if (active)
                setData(result);
        })
            .catch((error: unknown) => {
            if (active) {
                setLoadError(error instanceof Error
                    ? error.message
                    : "Không tải được dữ liệu đối soát.");
            }
        })
            .finally(() => {
            if (active)
                setLoading(false);
        });
        return () => {
            active = false;
        };
    }, [reload]);
    // Điều kiện hợp lệ của đơn hàng để đối soát: status = delivered và CodCollected > 0
    type EligibleShipmentWithOwner = SettlementData["eligibleShipments"][number] & { customerId?: number | null };
    const eligible = ((data?.eligibleShipments ?? []) as EligibleShipmentWithOwner[])
        .filter((s) => s.status === "delivered" && (s.codCollected ?? 0) > 0);
    const chosen = eligible.filter((shipment) => chosenShipmentIds.includes(shipment.id));
    const owners = new Set(chosen.map((shipment) => shipment.customerId));
    const invalidOwnerSelection = chosen.length > 1 &&
        (owners.size !== 1 || chosen.some((shipment) => shipment.customerId == null));
    const settlements = data?.settlements ?? [];
    const selected = settlements.find((item) => item.id === selectedId);
    const totalCod = chosen.reduce((sum, shipment) => sum + shipment.codCollected, 0);
    // Áp dụng quy tắc tính phí tự động:
    // - Loại shop_prepaid: không trừ Shipping Fee khỏi COD (0)
    // - Loại deduct_cod: trừ trực tiếp Shipping Fee khỏi COD Settlement (shipment.fee)
    // - Loại recipient: người nhận trả Shipping Fee (0)
    const deduction = chosen.reduce((sum, shipment) => sum + (shipment.feePayer === "deduct_cod" ? shipment.fee : 0), 0);
    const previewNet = totalCod - deduction + adjustment;
    async function createBatch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || chosen.length === 0 || invalidOwnerSelection)
            return;
        setBusy(true);
        setError("");
        setSuccess("");
        try {
            const settlement = await api.createSettlement({
                shipmentIds: chosen.map((shipment) => shipment.id),
                adjustment,
                adjustmentReason: reason,
            });
            const included = new Set(settlement.lines.map((line) => line.shipmentId));
            setData((current) => current
                ? {
                    eligibleShipments: current.eligibleShipments.filter((shipment) => !included.has(shipment.id)),
                    settlements: [settlement, ...current.settlements],
                }
                : current);
            setAdjustment(0);
            setReason("");
            setChosenShipmentIds((previous) => previous.filter((id) => !included.has(id)));
            setSelectedId(settlement.id);
            setSuccess("Đã lập kỳ đối soát. Chưa ghi nhận thanh toán.");
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Không lập được kỳ.");
        }
        finally {
            setBusy(false);
        }
    }
    if (loading) {
        return (<section className="panel">
        <p role="status">Đang tải đối soát…</p>
      </section>);
    }
    if (loadError || !data) {
        return (<section className="panel">
        <p className="notice error" role="alert">
          {loadError || "Không có dữ liệu."}
        </p>
        <button onClick={() => setReload((value) => value + 1)}>
          Thử lại
        </button>
      </section>);
    }
    return (<>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Đối soát COD</h2>
            <p className="muted">
              {"Theo dõi kỳ đối soát và kết quả thanh toán."}
            </p>
          </div>

          <button disabled={busy || Boolean(selected)} onClick={() => setReload((value) => value + 1)}>
            Tải lại
          </button>
        </div>

        {error && (<div className="notice error" role="alert">{error}</div>)}
        {success && (<div className="notice success" role="status">{success}</div>)}

        <p>
          <strong>{eligible.length}</strong> đơn COD đã giao thành công,
          chưa thuộc kỳ đối soát.
        </p>
        {canManage && eligible.length > 0 && (
          <p className="muted">
            <strong>Chọn từng vận đơn</strong> cần lập kỳ. Một kỳ chỉ chứa các đơn của cùng một Shop;
            không bắt buộc gộp tất cả các đơn đang chờ.
          </p>
        )}

        {eligible.length > 0 && (<div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {canManage && <th>Chọn</th>}
                  <th>Vận đơn</th>
                  {canManage && <th>Mã Shop</th>}
                  <th>COD đã thu</th>
                  <th>Phí khấu trừ COD</th>
                </tr>
              </thead>
              <tbody>
                {eligible.map((shipment) => (<tr key={shipment.id}>
                    {canManage && (
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Chọn vận đơn ${shipment.id} để lập kỳ đối soát`}
                          checked={chosenShipmentIds.includes(shipment.id)}
                          onChange={(event) => {
                            setChosenShipmentIds((current) => event.target.checked
                              ? [...current, shipment.id]
                              : current.filter((id) => id !== shipment.id));
                          }}
                        />
                      </td>
                    )}
                    <td className="tracking-code">{shipment.id}</td>
                    {canManage && <td>{shipment.customerId ?? "—"}</td>}
                    <td>{money(shipment.codCollected)}</td>
                    <td>
                      {money(shipment.feePayer === "deduct_cod"
                    ? shipment.fee
                    : 0)}
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}

        {canManage && eligible.length > 0 && (<form onSubmit={createBatch} className="settlement-form">
            <fieldset disabled={busy}>
              {invalidOwnerSelection && (
                <p className="notice error" role="alert">
                  Không thể gộp nhiều Shop trong một kỳ. Hãy chỉ chọn các đơn có cùng Mã Shop.
                </p>
              )}
              <p className="muted">Đã chọn: <strong>{chosen.length} đơn</strong> · COD {money(totalCod)} ·
                Khấu trừ {money(deduction)}.
              </p>
              <div className="form-grid">
                <label>
                  Điều chỉnh (đ)
                  <input type="number" step="1" required value={Number.isFinite(adjustment) ? adjustment : ""} onChange={(event) => setAdjustment(event.target.valueAsNumber)}/>
                  <span className="muted">
                    Số dương cộng thêm; số âm khấu trừ thêm.
                  </span>
                </label>

                <label>
                  Lý do điều chỉnh
                  <input value={reason} maxLength={1000} required={adjustment !== 0} onChange={(event) => setReason(event.target.value)}/>
                </label>
              </div>

              <div className="settlement-total">
                <span>Số tiền dự kiến trả shop</span>
                <strong>
                  {chosen.length > 0 && Number.isFinite(previewNet) ? money(previewNet) : "—"}
                </strong>
              </div>

              <button type="submit" className="primary" disabled={Boolean(selected) || chosen.length === 0 || invalidOwnerSelection || !Number.isFinite(previewNet)}>
                {busy ? "Đang lập kỳ…" : `Lập kỳ cho ${chosen.length} đơn đã chọn`}
              </button>
            </fieldset>
          </form>)}
      </section>

      <section className="panel">
        <div className="panel-heading">
          <h2>Lịch sử đối soát</h2>
        </div>

        {settlements.length === 0 ? (<p className="muted">Chưa có kỳ đối soát.</p>) : (<div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ngày lập</th>
                  <th>Số đơn</th>
                  <th>Trả shop</th>
                  <th>Trạng thái</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((settlement) => (<tr key={settlement.id}>
                    <td>
                      {new Date(settlement.createdAt).toLocaleString("vi-VN")}
                    </td>
                    <td>{settlement.lines.length}</td>
                    <td>{money(settlement.netAmount)}</td>
                    <td>
                      <span className="badge">
                        {settlement.status === "pending"
                    ? "Chờ hoàn tất"
                    : "Đã hoàn tất"}
                      </span>
                    </td>
                    <td>
                      <button disabled={busy || Boolean(selected)} onClick={() => setSelectedId(settlement.id)}>
                        Xem kỳ
                      </button>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </section>

      {selected && (<SettlementDetail key={selected.id} settlement={selected} canManage={canManage} onClose={() => setSelectedId(null)} onCompleted={(updated) => {
                setData((current) => current
                    ? {
                        ...current,
                        settlements: current.settlements.map((item) => item.id === updated.id ? updated : item),
                    }
                    : current);
                setSelectedId(null);
                setSuccess("Đã ghi nhận hoàn tất kỳ đối soát.");
            }}/>)}
    </>);
}
interface SettlementDetailProps {
    settlement: Settlement;
    canManage: boolean;
    onClose: () => void;
    onCompleted: (settlement: Settlement) => void;
}
function SettlementDetail({ settlement, canManage, onClose, onCompleted, }: SettlementDetailProps) {
    const [reference, setReference] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function complete(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy || !confirmed)
            return;
        setBusy(true);
        setError("");
        try {
            const updated = await api.completeSettlement(settlement.id, reference);
            onCompleted(updated);
        }
        catch (error) {
            setError(error instanceof Error ? error.message : "Không hoàn tất được.");
        }
        finally {
            setBusy(false);
        }
    }
    return (<section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Chi tiết kỳ đối soát</h2>
          <p className="muted tracking-code">{settlement.id}</p>
        </div>
        <button disabled={busy} onClick={onClose}>Đóng</button>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Vận đơn</th>
              <th>COD</th>
              <th>Phí khấu trừ</th>
            </tr>
          </thead>
          <tbody>
            {settlement.lines.map((line) => (<tr key={line.shipmentId}>
                <td className="tracking-code">{line.shipmentId}</td>
                <td>{money(line.codCollected)}</td>
                <td>{money(line.shippingDeduction)}</td>
              </tr>))}
          </tbody>
        </table>
      </div>

      <dl className="settlement-breakdown">
        <div><dt>Tổng COD</dt><dd>{money(settlement.totalCod)}</dd></div>
        <div>
          <dt>Phí khấu trừ</dt>
          <dd>{money(settlement.shippingDeduction)}</dd>
        </div>
        <div><dt>Điều chỉnh</dt><dd>{money(settlement.adjustment)}</dd></div>
        <div><dt>Trả shop</dt><dd>{money(settlement.netAmount)}</dd></div>
      </dl>

      {settlement.adjustmentReason && (<p className="muted">
          Lý do điều chỉnh: {settlement.adjustmentReason}
        </p>)}

      {settlement.status === "completed" ? (<div className="notice success">
          <p>
            Hoàn tất lúc:{" "}
            {settlement.completedAt
                ? new Date(settlement.completedAt).toLocaleString("vi-VN")
                : "—"}
          </p>
          <p>
            {settlement.netAmount === 0
                ? "Số dư bằng 0; không có giao dịch chuyển tiền."
                : `Tham chiếu: ${settlement.paymentReference}`}
          </p>
        </div>) : canManage ? (<form onSubmit={complete}>
          {error && (<p className="notice error" role="alert">{error}</p>)}

          <fieldset disabled={busy}>
            {settlement.netAmount > 0 && (<label>
                Mã tham chiếu thanh toán
                <input required maxLength={200} value={reference} onChange={(event) => setReference(event.target.value)} placeholder={"Mã giao dịch"}/>
              </label>)}

            <label className="checkbox">
              <input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}/>
              {settlement.netAmount > 0
                ? "Xác nhận khoản thanh toán đã được thực hiện."
                : "Xác nhận hoàn tất kỳ có số dư bằng 0."}
            </label>

            <div className="actions settlement-form">
              <button className="primary" type="submit" disabled={!confirmed}>
                {busy ? "Đang lưu…" : "Ghi nhận hoàn tất"}
              </button>
            </div>
          </fieldset>
        </form>) : (<p className="muted">Kỳ đang chờ bộ phận điều hành hoàn tất.</p>)}
    </section>);
}
