import { request } from "../lib/http";

export interface RequestOtpResult {
  message: string;
  demoOtp?: string;
  expiresInSeconds?: number;
}

export async function requestPasswordResetOtp(phone: string): Promise<RequestOtpResult> {
  return request<RequestOtpResult>("/auth/forgot-password/request", {
    method: "POST",
    body: JSON.stringify({ phone: phone.trim() }),
  });
}

export async function resetPasswordByOtp(input: {
  phone: string;
  otp: string;
  newPassword: string;
}): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/forgot-password/reset", {
    method: "POST",
    body: JSON.stringify({
      phone: input.phone.trim(),
      otp: input.otp.trim(),
      newPassword: input.newPassword,
    }),
  });
}
