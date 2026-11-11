# Sprint 3 — Điều phối theo dịch vụ (bản thử nghiệm riêng)

> Branch: `feature/s3-service-dispatch`, tách từ `integration/sprint3-pre-report`.
> Chỉ merge sau khi CI và kiểm thử thực tế trên **DeliverySystemDB** đạt yêu cầu.

## 1. Ba loại dịch vụ và chính sách hiện thực

| `Shipment.Service` | Chiến lược hiện tại trong branch này | Phạm vi |
|---|---|---|
| `standard` | `area_route` — phân Staff theo `DeliveryAreaId`, `StaffArea`, sức chứa | Operations có thể gom các đơn đã phân cho cùng Staff thành tuyến |
| `fast` | `priority_area` — cùng điều kiện phân Staff theo khu vực, ghi dấu ưu tiên trong sự kiện | **Chưa** có bộ tối ưu SLA và thời gian tuyến tự động |
| `express` | `gps_on_demand` — ưu tiên Staff có GPS đang chia sẻ, gần điểm lấy hàng, còn sức chứa; không yêu cầu cùng khu vực giao | Nếu thiếu GPS đủ mới, dự phòng Staff phụ trách **phường lấy hàng**, không phải phường giao |

### Giới hạn / nguyên tắc an toàn

- **Lấy hàng ở phường A, giao ở phường B là hợp lệ**. Mỗi địa chỉ cần khai báo đúng tên phường tương ứng (validation văn bản; **không phải kiểm tra ranh giới GIS**).
- Đơn `shop_prepaid` phải được thanh toán mới có thể được phân công; điều kiện này cũng áp dụng khi kích hoạt tuyến.
- Mỗi Shipment chỉ có tối đa một `DeliveryAssignment` đang active.
- Staff đã **từ chối** một Shipment không được tự động nhận lại đúng Shipment đó.
- Khi từ chối, Backend lưu việc từ chối rồi thử tìm Staff khác. Nếu không có người phù hợp, chờ Operations xử lý.
- Với Hỏa tốc, GPS đủ mới trong **15 phút**, độ chính xác được báo cáo không quá **1 km**, điểm lấy hàng tối đa **20 km đường chim bay** so với GPS để ưu tiên; các ngưỡng này chỉ là cấu hình thử nghiệm, **không phải cam kết SLA, khoảng cách đường bộ hoặc giới hạn vận chuyển liên tỉnh**.
- Nếu chưa có GPS đủ điều kiện, dự phòng chỉ trong StaffArea của **phường lấy hàng** và phải còn sức chứa. Không suy đoán GPS người đang nghỉ/không chia sẻ.
- Vì `StaffLocation` hiện gắn với **nhiệm vụ đang thực hiện**, Staff hoàn toàn rảnh và chưa nhận đơn chưa có GPS chủ động để xếp hạng. Cần mở rộng chế độ *available-location opt-in* trước khi đưa `gps_on_demand` vào sản phẩm thực.
- `StaffArea.MaxActiveOrders` hiện là hạn mức theo khu vực; hỏa tốc tạm dùng mức lớn nhất trong các khu vực Staff được cấu hình làm trần tải tổng, cần thiết kế capacity riêng nếu triển khai chính thức.
- Kích hoạt tuyến không cho trộn **hỏa tốc với nhiều đơn khác**. Một đơn hỏa tốc riêng vẫn có thể có stop lấy + giao.
- Kho trung chuyển / scan vào giỏ / chuyển Staff lấy hàng sang Staff giao hàng / tự gom đơn / tìm tuyến đường tối ưu **chưa tự động hoàn chỉnh**. Không demo như đã có.
- Không tính giá ngoài tỉnh, giao tỉnh hay đảm bảo thời gian 2–5 ngày ở bản này; bảng giá hiện tại chưa dựa trên quãng đường.
- Operations vẫn chỉ quản lý trên **Web** theo phạm vi demo của nhóm. Mobile kiểm thử Customer và Staff.

## 2. Testcase cho buổi báo cáo

1. **TC-DSP-01 Tiêu chuẩn:** Customer tạo đơn `standard`, `feePayer=recipient`, `DeliveryAreaId=Hòa Hưng` hợp lệ. Operations thấy `AssignmentSource=auto`, nhân viên trong StaffArea Hòa Hưng.
2. **TC-DSP-02 Giao nhanh:** Customer tạo `fast` với dữ liệu tương tự; có sự kiện `assigned_staff` ghi rõ `Giao nhanh - ưu tiên khu vực`.
3. **TC-DSP-03 Hỏa tốc có GPS:** Staff đang chia sẻ GPS từ một nhiệm vụ active, vừa gửi vị trí hợp lệ; Customer tạo `express` ở khu vực lấy hàng phù hợp hoặc khác khu vực Staff phụ trách. Hệ thống ưu tiên Staff gần điểm lấy theo GPS nếu còn tải. Xem event `[Hỏa tốc - GPS]`.
4. **TC-DSP-04 Hỏa tốc không có GPS:** Customer tạo `express` kèm `PickupAreaId`; khi không có GPS phù hợp, Staff có `StaffArea` ở phường lấy hàng được đề xuất, event ghi `[Hỏa tốc - dự phòng khu vực lấy hàng]`. Nếu không ai phù hợp, chờ phân công, không tự chọn ngẫu nhiên.
5. **TC-DSP-05 Staff từ chối:** Đăng nhập Staff và từ chối phân công có lý do. Assignment cũ `rejected`, `IsActive=false`; đơn được thử tự phân lại cho Staff **khác** hoặc chuyển chờ Operations.
6. **TC-DSP-06 Bảo vệ tuyến:** Tạo route có >=2 Shipment gồm `express` → kích hoạt bị chặn. Tạo route có `shop_prepaid` chưa thanh toán → kích hoạt bị chặn.
7. **TC-DSP-07 Tuyến tiêu chuẩn/nhanh:** Staff phụ trách phường giao, shipment hợp lệ; route có thể thêm nhiều stops, chọn thứ tự và kích hoạt (nếu không có active assignment khác Staff).
8. **TC-DSP-08 Đồng bộ:** Operations phân công trên Web; Staff Mobile làm mới → thấy đơn và có thể nhận/từ chối; Customer Web/Mobile thấy trạng thái cùng Backend.

**Lưu ý:** Unit/smoke test chỉ kiểm tra hàm chính sách GPS/strategy. Test API và SQL Server thật vẫn bắt buộc trước khi merge.

## 3. SQL chỉ đọc để đối chiếu

```sql
SELECT TOP 15 s.Id, s.Service, s.Status, s.PickupAreaId, s.DeliveryAreaId,
       a.StaffId, a.AssignmentSource, a.Status AS AssignmentStatus, a.IsActive
FROM dbo.Shipments s
LEFT JOIN dbo.DeliveryAssignments a
    ON a.ShipmentId = s.Id AND a.IsActive = 1
ORDER BY s.CreatedAt DESC;

SELECT TOP 25 ShipmentId, Status, Note, At
FROM dbo.ShipmentEvents
WHERE Status IN ('assigned_staff', 'assignment_rejected', 'waiting_assignment')
ORDER BY At DESC;

SELECT StaffId, Latitude, Longitude, AccuracyMeters, UpdatedAt
FROM dbo.StaffLocations
ORDER BY UpdatedAt DESC;
```

## 4. Cách phát triển tiếp sau demo

1. Tách *pickup-assignment* và *last-mile-assignment* (đơn tiêu chuẩn/nhanh) có hub scan.
2. Thêm GPS opt-in lúc Staff đang sẵn sàng, permission, thời gian hết hạn và kiểm soát quyền riêng tư.
3. Route batching: tập hợp đơn theo khu vực + thứ tự ưu tiên `fast`, đề xuất tuyến theo khoảng cách đường bộ và tải xe.
4. SLA và giá theo loại dịch vụ, quãng đường, vùng nội tỉnh/liên tỉnh, loại hàng; cảnh báo quá giờ và hạn mức.
5. API/Flutter cho khách theo dõi từng chặng, Staff hoàn thành từng stop và trả COD.

## 5. Biên dịch

```powershell
dotnet build backend/Back_DeliverySystem/Back_DeliverySystem/Back_DeliverySystem.csproj
dotnet run --project backend/Back_DeliverySystem/DispatchPolicySmokeTests/DispatchPolicySmokeTests.csproj
```
