import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { authApi } from "@/services/api";
import type { User } from "@/types";
import { getScmRole } from "@/utils/scmRole";

export type UserRole = "employee" | "general_employee" | "regular_staff" | "staff" | "procurement_manager" | "finance" | "executive" | "supply_chain_director" | "supply_chain" | "chairman" | "logistics_manager" | "logistics_officer" | "procurement" | "logistics" | "admin" | "vendor" | "finance_officer";

/** SCM staff/employee roles — checks supply_chain_role only (not hris_role). */
export const isEmployeeRole = (role?: string): boolean => {
  const employeeRoles = [
    "employee",
    "general_employee",
    "regular_staff",
    "staff",
  ];
  return role ? employeeRoles.includes(role) : false;
};

/** Convenience: isEmployeeRole for an auth/API user object. */
export const isScmEmployee = (user?: { supply_chain_role?: string | null; role?: string | null } | null): boolean =>
  isEmployeeRole(getScmRole(user));

export interface AuthUser {
  id: number;
  email: string;
  /** SCM permission role — source of truth for SCM gates. */
  supply_chain_role: UserRole;
  /** HRIS role — display-only in SCM. */
  hris_role?: string | null;
  /** @deprecated Alias of supply_chain_role for backward compatibility. */
  role: UserRole;
  name: string;
  department: string | null;
  employeeId?: number;
  signature_url?: string | null;
}

function mapAuthUserFromApi(data: User): AuthUser {
  const scmRole = data.supply_chain_role ?? data.role;
  const d = data as User & { signatureUrl?: string };
  return {
    id: data.id,
    email: data.email,
    supply_chain_role: scmRole as UserRole,
    hris_role: data.hris_role ?? null,
    role: scmRole as UserRole,
    name: data.name,
    department: data.department ?? null,
    employeeId: data.employeeId,
    signature_url: d.signature_url ?? d.signatureUrl ?? null,
  };
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async (): Promise<void> => {
    try {
      // Call logout API
      await authApi.logout();
    } catch (error) {
      // Continue with logout even if API call fails
      console.error("Logout API error:", error);
    } finally {
      setUser(null);
      localStorage.removeItem("authToken");
      localStorage.removeItem("userData");
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("tokenExpiry");
      sessionStorage.removeItem("authToken");
      sessionStorage.removeItem("userData");
    }
  }, []);

  useEffect(() => {
    // Check for existing session - try localStorage first (persistent), then sessionStorage
    let token = localStorage.getItem("authToken");
    let storedUser = localStorage.getItem("userData");
    let tokenExpiry = localStorage.getItem("tokenExpiry");
    let storage: Storage = localStorage;
    
    // If not in localStorage, check sessionStorage
    if (!token || !storedUser) {
      token = sessionStorage.getItem("authToken");
      storedUser = sessionStorage.getItem("userData");
      tokenExpiry = sessionStorage.getItem("tokenExpiry");
      storage = sessionStorage;
    }
    
    if (token && storedUser) {
      // Check if token has expired
      if (tokenExpiry) {
        const expiryDate = new Date(tokenExpiry);
        if (expiryDate < new Date()) {
          // Token expired, clear session
          logout();
          setLoading(false);
          return;
        }
      }
      
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        
        // Verify token is still valid by calling /auth/me
        authApi.getCurrentUser().then((response) => {
          if (response.success && response.data) {
            const updatedUser = mapAuthUserFromApi(response.data);
            setUser(updatedUser);
            storage.setItem("userData", JSON.stringify(updatedUser));
            
            // Update token expiration if provided
            if ((response.data as any).tokenExpiresAt) {
              storage.setItem("tokenExpiry", (response.data as any).tokenExpiresAt);
            }
            
            // Check if token is expiring soon (within 7 days) and refresh it
            if ((response.data as any).tokenExpiresAt) {
              const expiryDate = new Date((response.data as any).tokenExpiresAt);
              const daysUntilExpiry = (expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
              
              // Refresh token if it expires within 7 days
              if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
                authApi.refreshToken().then((refreshResponse) => {
                  if (refreshResponse.success && refreshResponse.data) {
                    storage.setItem("authToken", refreshResponse.data.token);
                    if (refreshResponse.data.expiresAt) {
                      storage.setItem("tokenExpiry", refreshResponse.data.expiresAt);
                    }
                  }
                }).catch((error) => {
                  console.warn("Token refresh failed:", error);
                  // Don't logout on refresh failure, token might still be valid
                });
              }
            }
          } else {
            // Token invalid, clear session
            logout();
          }
          setLoading(false);
        }).catch(() => {
          logout();
          setLoading(false);
        });
      } catch (error) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userData");
        localStorage.removeItem("tokenExpiry");
        sessionStorage.removeItem("authToken");
        sessionStorage.removeItem("userData");
        sessionStorage.removeItem("tokenExpiry");
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [logout]);


  const login = async (email: string, password: string, rememberMe: boolean = true): Promise<{ success: boolean; error?: string }> => {
    if (!email || !password) {
      return { success: false, error: "Please enter email and password" };
    }

    try {
      // First try the real API with remember_me flag
      const response = await authApi.login({ email, password, remember_me: rememberMe });

      if (response.success && response.data) {
        const userData = response.data.user;
        const token = response.data.token;
        const expiresAt = response.data.expiresAt; // Token expiration from backend

        const authUser = mapAuthUserFromApi(userData);

        setUser(authUser);
        
        // Use localStorage for "remember me", sessionStorage otherwise
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem("authToken", token);
        storage.setItem("userData", JSON.stringify(authUser));
        storage.setItem("isAuthenticated", "true");
        
        // Store token expiration for client-side validation
        if (expiresAt) {
          storage.setItem("tokenExpiry", expiresAt);
        }

        return { success: true };
      } else {
        return { success: false, error: response.error || "Login failed" };
      }
    } catch (error: any) {
      return { success: false, error: error.message || "An error occurred during login" };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
