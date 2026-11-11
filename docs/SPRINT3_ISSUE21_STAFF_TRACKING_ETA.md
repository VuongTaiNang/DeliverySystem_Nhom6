# Sprint 3 Issue 21 Theo doi vi tri Staff va ETA

Branch: `feature/21-staff-tracking-eta`
Issue: `#21`

## Pham vi da trien khai

- Mobile Staff xin quyen GPS khi Staff tu bam **Bat dau chia se vi tri** cho mot assignment da nhan.
- Mobile gui latitude, longitude, do chinh xac va assignmentId ve API. Khong co theo doi nen va Staff co the dung chia se bat cu luc nao.
- Backend chi chap nhan Staff dang dang nhap va assignment dang `accepted` hoac `in_progress`; vi tri cu duoc thay the de chi luu vi tri gan nhat.
- Operations co trang `/operations/staff-tracking`, ban do OpenStreetMap, diem Staff, diem lay/giao, khoang cach, ETA, do chinh xac va thoi diem cap nhat.
- ETA la uoc tinh theo khoang cach duong chim bay va toc do 25 km/h. Day khong phai chi dan duong di va phai hien ro gia dinh nay tren UI.

## API contract

### Staff cap nhat vi tri

`POST /api/v1/staff/location` - role `staff`

```json
{
  "assignmentId": 12,
  "latitude": 10.7769,
  "longitude": 106.7009,
  "accuracyMeters": 14.5
}
```

Backend tu lay Staff ID tu JWT, khong nhan staffId tu client. API tra `409` neu assignment khong thuoc Staff hoac chua duoc nhan. Toa do phai nam trong khoang hop le; do chinh xac neu co phai tu 0 den 10.000 m.

### Geofence den diem (tich hop Issue 26)

`POST /api/v1/staff/assignments/{assignmentId}/geofence-arrivals` - role `staff`

```json
{
  "stage": "pickup",
  "latitude": 10.7769,
  "longitude": 106.7009,
  "accuracy": 14.5
}
```

Mobile chi bat Geofence foreground khi Staff mo chi tiet don va don dang `picking_up` hoac `delivering`. Backend doi chieu assignment thuoc Staff, trang thai don va toa do diem den; chi ghi `ShipmentEvent` la `arrived_at_pickup` hoac `arrived_at_delivery` khi GPS nam trong ban kinh 150 m. Event la bang chung lich su, **khong tu dong chuyen trang thai** pickup/giao hang.

### Operations theo doi

`GET /api/v1/operations/staff-tracking` - role `operations`

Moi dong tra ve Staff, shipment, toa do Staff, trang thai assignment, target pickup/delivery, khoang cach va `etaMinutes`. `isStale=true` khi cap nhat cu hon 5 phut. `distanceKm` va `etaMinutes` bang `null` neu Shipment chua co toa do diem den.

## Chay va kiem thu

1. Cap nhat database truoc khi chay backend:

```powershell
dotnet ef database update --project backend/Back_DeliverySystem/Back_DeliverySystem/Back_DeliverySystem.csproj
```

2. Tai dependency Mobile:

```powershell
cd mobile
flutter pub get
flutter run
```

3. Dang nhap bang Staff co assignment. Nhan don, vao **Chia se vi tri**, chon assignment va bam **Bat dau chia se vi tri**. Cho phep GPS khi he dieu hanh hoi.

4. Dang nhap Web bang Operations va mo `/operations/staff-tracking`. Kiem tra vi tri, thoi diem cap nhat, khoang cach va ETA.

## Kiem thu bat buoc

| Tinh huong | Ket qua mong doi |
|---|---|
| Staff chua nhan don | Khong co assignment de bat chia se |
| Tu choi quyen GPS | Thong bao ro rang, khong gui API |
| GPS tat | Thong bao bat Dich vu vi tri |
| Mat mang khi chia se | Hien loi, khong gia mao vi tri moi |
| Assignment cua Staff khac | Backend tra loi loi, khong cap nhat |
| Staff o ngoai 150 m cua diem den | Geofence khong tao event |
| Staff vao ban kinh 150 m va GPS chinh xac <= 100 m | Tao mot event den diem, khong doi trang thai don |
| Shipment khong co toa do diem den | Van luu GPS, Operations hien chua co khoang cach/ETA |
| Vi tri cu hon 5 phut | Operations gan nhan Vi tri cu |

## Phan phoi hop voi Issue 26

Issue #26 dung chung ham `StaffLocationService.ensureForegroundLocationPermission()` de xin quyen GPS foreground. Geofence co stream rieng theo man hinh chi tiet don va tu dung sau khi ghi nhan event; khong xin quyen background, khong tu dong doi trang thai giao hang.

## Luu y privacy

- Chi theo doi khi Staff bam bat chia se va co assignment `accepted`.
- Khong xin `ACCESS_BACKGROUND_LOCATION`; khi dong/dua app xuong nen thi stream khong duoc dam bao chay.
- Android dung quyen fine va coarse location. iOS dung `NSLocationWhenInUseUsageDescription`.
