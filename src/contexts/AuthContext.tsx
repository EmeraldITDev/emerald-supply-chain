import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { authApi } from "@/services/api";

export type UserRole = "employee" | "procurement_manager" | "finance" | "executive" | "supply_chain_director" | "chairman" | "logistics_manager" | "procurement" | "logistics";

export interface AuthUser {
  id: number;
  email: string;
  role: UserRole;
  name: string;
  department: string | null;
  employeeId?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
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
    }
  }, []);

  useEffect(() => {
    // Check for existing session and validate token
    const token = localStorage.getItem("authToken");
    const storedUser = localStorage.getItem("userData");
    
    if (token && storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        
        // Verify token is still valid by calling /auth/me
        authApi.getCurrentUser().then((response) => {
          if (response.success && response.data) {
            const updatedUser: AuthUser = {
              id: response.data.id,
              email: response.data.email,
              role: response.data.role as UserRole,
              name: response.data.name,
              department: response.data.department,
              employeeId: response.data.employeeId,
            };
            setUser(updatedUser);
            localStorage.setItem("userData", JSON.stringify(updatedUser));
          } else {
            // Token invalid, clear session
            logout();
          }
        }).catch(() => {
          logout();
        });
      } catch (error) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userData");
      }
    }
    setLoading(false);
  }, [logout]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!email || !password) {
      return { success: false, error: "Please enter email and password" };
    }

    try {
      const response = await authApi.login({ email, password });

      if (response.success && response.data) {
        const userData = response.data.user;
        const token = response.data.token;

        const authUser: AuthUser = {
          id: userData.id,
          email: userData.email,
          role: userData.role as UserRole,
          name: userData.name,
          department: userData.department,
          employeeId: userData.employeeId,
        };

        setUser(authUser);
        localStorage.setItem("authToken", token);
        localStorage.setItem("userData", JSON.stringify(authUser));
        localStorage.setItem("isAuthenticated", "true");

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
