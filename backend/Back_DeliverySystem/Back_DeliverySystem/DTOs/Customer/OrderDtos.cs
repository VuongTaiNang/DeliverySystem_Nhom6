using System.ComponentModel.DataAnnotations;

namespace Back_DeliverySystem.DTOs.Customer;

public class ShipmentInput
{
    // =====================================================
    // NGƯỜI GỬI
    // =====================================================

    [Required(ErrorMessage = "Tên người gửi không được để trống.")]
    [StringLength(
        100,
        MinimumLength = 2,
        ErrorMessage = "Tên người gửi phải từ 2 đến 100 ký tự."
    )]
    public string SenderName { get; set; } = string.Empty;


    [Required(ErrorMessage = "Số điện thoại người gửi không được để trống.")]
    [RegularExpression(
        @"^0[0-9]{9}$",
        ErrorMessage =
            "Số điện thoại người gửi phải gồm 10 số và bắt đầu bằng 0."
    )]
    public string SenderPhone { get; set; } = string.Empty;


    [Required(ErrorMessage = "Địa chỉ lấy hàng không được để trống.")]
    [StringLength(
        500,
        MinimumLength = 3,
        ErrorMessage =
            "Địa chỉ lấy hàng phải từ 3 đến 500 ký tự."
    )]
    public string PickupAddress { get; set; } = string.Empty;


    // Khu vực hành chính chuẩn hóa: phường/xã/đặc khu.
    // Tạm thời nullable để không phá client cũ; UI mới sẽ bắt buộc chọn.
    [Range(
        1,
        int.MaxValue,
        ErrorMessage = "Khu vực lấy hàng không hợp lệ."
    )]
    public int? PickupAreaId { get; set; }


    // =====================================================
    // TỌA ĐỘ ĐIỂM LẤY HÀNG
    // =====================================================

    [Range(
        -90.0,
        90.0,
        ErrorMessage =
            "Vĩ độ điểm lấy hàng phải từ -90 đến 90."
    )]
    public double? PickupLatitude { get; set; }


    [Range(
        -180.0,
        180.0,
        ErrorMessage =
            "Kinh độ điểm lấy hàng phải từ -180 đến 180."
    )]
    public double? PickupLongitude { get; set; }


    // =====================================================
    // NGƯỜI NHẬN
    // =====================================================

    [Required(ErrorMessage = "Tên người nhận không được để trống.")]
    [StringLength(
        100,
        MinimumLength = 2,
        ErrorMessage = "Tên người nhận phải từ 2 đến 100 ký tự."
    )]
    public string RecipientName { get; set; } = string.Empty;


    [Required(ErrorMessage = "Số điện thoại người nhận không được để trống.")]
    [RegularExpression(
        @"^0[0-9]{9}$",
        ErrorMessage =
            "Số điện thoại người nhận phải gồm 10 số và bắt đầu bằng 0."
    )]
    public string RecipientPhone { get; set; } = string.Empty;


    [Required(ErrorMessage = "Địa chỉ giao hàng không được để trống.")]
    [StringLength(
        500,
        MinimumLength = 3,
        ErrorMessage =
            "Địa chỉ giao hàng phải từ 3 đến 500 ký tự."
    )]
    public string DeliveryAddress { get; set; } = string.Empty;


    // Đây là AreaId dùng để tự động phân Staff.
    [Range(
        1,
        int.MaxValue,
        ErrorMessage = "Khu vực giao hàng không hợp lệ."
    )]
    public int? DeliveryAreaId { get; set; }


    // =====================================================
    // TỌA ĐỘ ĐIỂM GIAO HÀNG
    // =====================================================

    [Range(
        -90.0,
        90.0,
        ErrorMessage =
            "Vĩ độ điểm giao hàng phải từ -90 đến 90."
    )]
    public double? DeliveryLatitude { get; set; }


    [Range(
        -180.0,
        180.0,
        ErrorMessage =
            "Kinh độ điểm giao hàng phải từ -180 đến 180."
    )]
    public double? DeliveryLongitude { get; set; }

    // =====================================================
    // HÀNG HÓA
    // =====================================================

    [Required(ErrorMessage = "Tên hàng hóa không được để trống.")]
    [StringLength(
        200,
        MinimumLength = 2,
        ErrorMessage =
            "Tên hàng hóa phải từ 2 đến 200 ký tự."
    )]
    public string Goods { get; set; } = string.Empty;


    [Range(
        typeof(decimal),
        "0.01",
        "1000",
        ErrorMessage =
            "Khối lượng phải lớn hơn 0 và không vượt quá 1000 kg."
    )]
    public decimal WeightKg { get; set; }


    [Range(
        typeof(decimal),
        "0.01",
        "500",
        ErrorMessage =
            "Chiều dài phải lớn hơn 0 và không vượt quá 500 cm."
    )]
    public decimal LengthCm { get; set; }


    [Range(
        typeof(decimal),
        "0.01",
        "500",
        ErrorMessage =
            "Chiều rộng phải lớn hơn 0 và không vượt quá 500 cm."
    )]
    public decimal WidthCm { get; set; }


    [Range(
        typeof(decimal),
        "0.01",
        "500",
        ErrorMessage =
            "Chiều cao phải lớn hơn 0 và không vượt quá 500 cm."
    )]
    public decimal HeightCm { get; set; }


    [Range(
        0,
        long.MaxValue,
        ErrorMessage =
            "Giá trị khai báo không được âm."
    )]
    public long DeclaredValue { get; set; }


    [Range(
        0,
        long.MaxValue,
        ErrorMessage =
            "Tiền COD không được âm."
    )]
    public long CodAmount { get; set; }


    // =====================================================
    // DỊCH VỤ
    // =====================================================

    [Required(ErrorMessage = "Loại phương tiện không được để trống.")]
    [RegularExpression(
        @"^(motorbike|car)$",
        ErrorMessage =
            "VehicleType chỉ được là motorbike hoặc car."
    )]
    public string VehicleType { get; set; } =
        "motorbike";


    [Required(ErrorMessage = "Loại dịch vụ không được để trống.")]
    [RegularExpression(
        @"^(standard|fast|express)$",
        ErrorMessage =
            "Service chỉ được là standard, fast hoặc express."
    )]
    public string Service { get; set; } =
        "standard";


    [Required(
        ErrorMessage =
            "Hình thức thanh toán phí vận chuyển không được để trống."
    )]
    [RegularExpression(
        @"^(shop_prepaid|deduct_cod|recipient)$",
        ErrorMessage =
            "FeePayer chỉ được là shop_prepaid, deduct_cod hoặc recipient."
    )]
    public string FeePayer { get; set; } =
        "shop_prepaid";


    [StringLength(
        500,
        ErrorMessage =
            "Ghi chú không được vượt quá 500 ký tự."
    )]
    public string Notes { get; set; } =
        string.Empty;
}


public class CreateShipmentRequest : ShipmentInput
{
    [Required(ErrorMessage = "QuoteId không được để trống.")]
    [StringLength(
        50,
        ErrorMessage = "QuoteId không hợp lệ."
    )]
    public string QuoteId { get; set; } =
        string.Empty;
}


public class TransitionRequest
{
    [Required(ErrorMessage = "Trạng thái không được để trống.")]
    [StringLength(30)]
    public string Status { get; set; } =
        string.Empty;


    [StringLength(
        500,
        ErrorMessage =
            "Ghi chú không được vượt quá 500 ký tự."
    )]
    public string Note { get; set; } =
        string.Empty;


    [Range(
        0,
        long.MaxValue,
        ErrorMessage =
            "Số tiền COD thu được không được âm."
    )]
    public long? CodCollected { get; set; }
}


public class CreatePickupLocationRequest
{
    [Required(ErrorMessage = "Tên địa điểm không được để trống.")]
    [StringLength(
        100,
        MinimumLength = 2,
        ErrorMessage =
            "Tên địa điểm phải từ 2 đến 100 ký tự."
    )]
    public string Name { get; set; } =
        string.Empty;


    [Required(ErrorMessage = "Tên người liên hệ không được để trống.")]
    [StringLength(
        100,
        MinimumLength = 2,
        ErrorMessage =
            "Tên người liên hệ phải từ 2 đến 100 ký tự."
    )]
    public string ContactName { get; set; } =
        string.Empty;


    [Required(ErrorMessage = "Số điện thoại liên hệ không được để trống.")]
    [RegularExpression(
        @"^0[0-9]{9}$",
        ErrorMessage =
            "Số điện thoại phải gồm 10 số và bắt đầu bằng 0."
    )]
    public string ContactPhone { get; set; } =
        string.Empty;


    [Required(ErrorMessage = "Địa chỉ không được để trống.")]
    [StringLength(
        500,
        MinimumLength = 3,
        ErrorMessage =
            "Địa chỉ phải từ 3 đến 500 ký tự."
    )]
    public string Address { get; set; } =
        string.Empty;
}