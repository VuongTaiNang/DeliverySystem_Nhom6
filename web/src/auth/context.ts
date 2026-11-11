import { createContext, useContext } from "react";
import type { SessionUser } from "../api";

export type AuthMode = "login" | "register";

export interface AuthContextValue {
  user: SessionUser | null;
  checkingSession: boolean;
  logout: () => Promise<void>;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  updateUser: (user: SessionUser) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("AuthContext chưa được khởi tạo.");
  }
  return context;
}
