using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Back_DeliverySystem.Models;

namespace Back_DeliverySystem.Services;

/// <summary>
/// Demo-level text consistency check: the address must explicitly state the
/// same ward/commune/special zone as the selected Area. This does NOT verify
/// geographic boundaries or prove that a map coordinate is physically inside
/// the ward; production GIS boundaries would be needed for that.
/// </summary>
public static class AreaAddressValidator
{
    public static bool MatchesDeclaredArea(string? address, Area area)
    {
        if (string.IsNullOrWhiteSpace(address)) return false;

        var normalizedAddress = Fold(address);
        var areaName = Fold(area.Name);
        var type = area.Type?.ToLowerInvariant();

        var (prefix, fullPrefix) = type switch
        {
            "commune" => (@"(?:xa\s+|x\.?\s*)", "xa "),
            "special_zone" => (@"dac\s+khu\s+", "dac khu "),
            _ => (@"(?:phuong\s+|p\.?\s*)", "phuong ")
        };

        var shortName = areaName.StartsWith(fullPrefix, StringComparison.Ordinal)
            ? areaName[fullPrefix.Length..].Trim()
            : areaName.Trim();

        if (shortName.Length == 0) return false;

        // Require an explicit "Phường/Xã ..." segment in the address, not
        // an accidental match within a road name such as "Đường Tân Hòa".
        var pattern = @"(?:^|[,;])\s*" + prefix +
                      Regex.Escape(shortName) + @"(?=\s*[,;]|$)";
        return Regex.IsMatch(normalizedAddress, pattern, RegexOptions.CultureInvariant);
    }

    private static string Fold(string value)
    {
        var decomposed = value.Trim().ToLowerInvariant()
            .Replace('đ', 'd').Normalize(NormalizationForm.FormD);
        var result = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                result.Append(c);
        }
        return Regex.Replace(result.ToString().Normalize(NormalizationForm.FormC),
            @"\s+", " ");
    }
}
