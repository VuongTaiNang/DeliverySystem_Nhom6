
import { useCallback, useEffect, useState } from "react";
import {
  getOperationsDashboard,
  type OperationsDashboard as DashboardData,
} from "./operationsDashboardApi";
import "./OperationsDashboard.css";

function OperationsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Lấy dữ liệu thống kê từ Backend
  const loadDashboard = useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const result = await getOperationsDashboard();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể tải dữ liệu Dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Tải dữ liệu khi mở trang và tự cập nhật mỗi 30 giây
  useEffect(() => {
    void loadDashboard();

    const interval = window.setInterval(() => {
      void loadDashboard();
    }, 30000);

    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("vi-VN").format(value);

  const formatTime = (value: string) =>
    new Date(value).toLocaleString("vi-VN");

  if (loading && !data) {
    return (
      <div className="operations-dashboard">
        <p>Đang tải dữ liệu tổng quan...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="operations-dashboard">
        <h2>Dashboard vận hành</h2>
        <p className="dashboard-error">{error}</p>
        <button onClick={() => void loadDashboard()}>
          Thử tải lại
        </button>
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      title: "Tổng đơn hàng",
      value: data.totalOrders,
      color: "blue",
    },
    {
      title: "Chưa phân công",
      value: data.unassignedOrders,
      color: "orange",
    },
    {
      title: "Đang giao",
      value: data.inDeliveryOrders,
      color: "purple",
    },
    {
      title: "Giao thành công",
      value: data.deliveredOrders,
      color: "green",
    },
    {
      title: "Giao thất bại",
      value: data.failedOrders,
      color: "red",
    },
    {
      title: "Đơn hoàn",
      value: data.returnedOrders,
      color: "gray",
    },
  ];

  return (
    <div className="operations-dashboard">
      <div className="dashboard-header">
        <div>
          <h2>Tổng quan vận hành</h2>
          <p>Theo dõi tình hình đơn hàng và nhân viên giao hàng</p>
        </div>

        <button
          className="dashboard-refresh"
          onClick={() => void loadDashboard()}
          disabled={loading}
        >
          {loading ? "Đang cập nhật..." : "Làm mới"}
        </button>
      </div>

      {error && <p className="dashboard-error">{error}</p>}

      <div className="dashboard-card-grid">
        {cards.map((card) => (
          <div
            className={`dashboard-card dashboard-${card.color}`}
            key={card.title}
          >
            <p>{card.title}</p>
            <strong>{formatNumber(card.value)}</strong>
          </div>
        ))}
      </div>

      <div className="dashboard-section">
        <h3>Tình trạng nhân viên giao hàng</h3>

        <div className="dashboard-staff-grid">
          <div className="dashboard-staff-item">
            <span>Available - Sẵn sàng</span>
            <strong>{formatNumber(data.staff.available)}</strong>
          </div>

          <div className="dashboard-staff-item">
            <span>Busy - Đang bận</span>
            <strong>{formatNumber(data.staff.busy)}</strong>
          </div>

          <div className="dashboard-staff-item">
            <span>Inactive - Ngừng hoạt động</span>
            <strong>{formatNumber(data.staff.inactive)}</strong>
          </div>

          <div className="dashboard-staff-item">
            <span>Tổng nhân viên</span>
            <strong>{formatNumber(data.staff.total)}</strong>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>Hiệu quả giao hàng</h3>

        <div className="dashboard-rate-grid">
          <div>
            <span>Tỷ lệ giao thành công</span>
            <strong>{data.successRate}%</strong>
          </div>

          <div>
            <span>Tỷ lệ giao thất bại</span>
            <strong>{data.failureRate}%</strong>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>Số đơn theo nhân viên</h3>

        <div className="dashboard-table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Mã nhân viên</th>
                <th>Họ tên</th>
                <th>Số đơn đang phân công</th>
              </tr>
            </thead>

            <tbody>
              {data.ordersByStaff.length > 0 ? (
                data.ordersByStaff.map((staff) => (
                  <tr key={staff.staffId}>
                    <td>{staff.employeeCode}</td>
                    <td>{staff.staffName}</td>
                    <td>{formatNumber(staff.totalOrders)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>Chưa có dữ liệu nhân viên.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-section">
        <h3>Số đơn theo khu vực</h3>

        <div className="dashboard-table-wrapper">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Mã khu vực</th>
                <th>Tên khu vực</th>
                <th>Tổng số đơn</th>
              </tr>
            </thead>

            <tbody>
              {data.ordersByArea.length > 0 ? (
                data.ordersByArea.map((area) => (
                  <tr key={area.areaId}>
                    <td>{area.areaCode}</td>
                    <td>{area.areaName}</td>
                    <td>{formatNumber(area.totalOrders)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>Chưa có dữ liệu khu vực.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="dashboard-updated">
        Cập nhật lần cuối: {formatTime(data.updatedAt)}
      </p>
    </div>
  );
}

export default OperationsDashboard;
