import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "../api/client";
import { login as loginRequest, logout as logoutRequest } from "../api/auth";
import { getProfile, type ProfileResponse } from "../api/profile";

type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  status: AuthStatus;
  user: ProfileResponse | null;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<ProfileResponse | null>(null);

  const refresh = useCallback(async () => {
    try {
      const profile = await getProfile();
      setUser(profile);
      setStatus("authenticated");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setStatus("anonymous");
        return;
      }

      throw error;
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {
      setUser(null);
      setStatus("anonymous");
    });
  }, [refresh]);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean) => {
    await loginRequest(email, password, rememberMe);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, logout, refresh }),
    [status, user, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth, AuthProvider içinde kullanılmalıdır.");
  }

  return context;
}
