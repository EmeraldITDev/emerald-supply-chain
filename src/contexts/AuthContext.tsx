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

  // Demo users for offline/testing mode
  const demoUsers: Record<string, AuthUser> = {
    'procurement@emeraldcfze.com': {
      id: 1,
      email: 'procurement@emeraldcfze.com',
      role: 'procurement_manager',
      name: 'Procurement Manager',
      department: 'Procurement',
    },
    'supply@emeraldcfze.com': {
      id: 2,
      email: 'supply@emeraldcfze.com',
      role: 'supply_chain_director',
      name: 'Supply Chain Director',
      department: 'Supply Chain',
    },
    'bunmi.babajide@emeraldcfze.com': {
      id: 3,
      email: 'bunmi.babajide@emeraldcfze.com',
      role: 'executive',
      name: 'Bunmi Babajide',
      department: 'Executive',
    },
    'laa@emeraldcfze.com': {
      id: 4,
      email: 'laa@emeraldcfze.com',
      role: 'chairman',
      name: 'Chairman',
      department: 'Executive',
    },
    'logistics@emeraldcfze.com': {
      id: 5,
      email: 'logistics@emeraldcfze.com',
      role: 'logistics_manager',
      name: 'Logistics Manager',
      department: 'Logistics',
    },
    'finance@emeraldcfze.com': {
      id: 6,
      email: 'finance@emeraldcfze.com',
      role: 'finance',
      name: 'Finance Manager',
      department: 'Finance',
    },
    'staff@emeraldcfze.com': {
      id: 7,
      email: 'staff@emeraldcfze.com',
      role: 'employee',
      name: 'Staff Employee',
      department: 'Operations',
    },
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!email || !password) {
      return { success: false, error: "Please enter email and password" };
    }

    try {
      // First try the real API
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
        // If API fails, check for demo user
        const demoUser = demoUsers[email.toLowerCase()];
        if (demoUser) {
          setUser(demoUser);
          localStorage.setItem("authToken", "demo-token");
          localStorage.setItem("userData", JSON.stringify(demoUser));
          localStorage.setItem("isAuthenticated", "true");
          return { success: true };
        }
        return { success: false, error: response.error || "Login failed" };
      }
    } catch (error: any) {
      // On network error, fall back to demo users
      const demoUser = demoUsers[email.toLowerCase()];
      if (demoUser) {
        setUser(demoUser);
        localStorage.setItem("authToken", "demo-token");
        localStorage.setItem("userData", JSON.stringify(demoUser));
        localStorage.setItem("isAuthenticated", "true");
        return { success: true };
      }
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
