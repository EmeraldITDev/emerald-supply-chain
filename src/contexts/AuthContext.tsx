import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserRole = "employee" | "procurement" | "finance";

export interface AuthUser {
  email: string;
  role: UserRole;
  name: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Role mapping based on email
const getRoleFromEmail = (email: string): { role: UserRole; name: string } => {
  if (email.includes("staff@emeraldcfze.com")) {
    return { role: "employee", name: "Employee User" };
  } else if (email.includes("procurement@emeraldcfze.com")) {
    return { role: "procurement", name: "Procurement Manager" };
  } else if (email.includes("finance@emeraldcfze.com") || email.includes("temitope")) {
    return { role: "finance", name: "Temitope Lawal" };
  }
  return { role: "employee", name: "Guest User" };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Check for existing session
    const storedEmail = localStorage.getItem("userEmail");
    const storedRole = localStorage.getItem("userRole") as UserRole;
    const storedName = localStorage.getItem("userName");
    
    if (storedEmail && storedRole && storedName) {
      setUser({ email: storedEmail, role: storedRole, name: storedName });
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simple validation
    if (!email || !password) {
      return false;
    }

    const { role, name } = getRoleFromEmail(email);
    
    const authUser: AuthUser = {
      email,
      role,
      name,
    };

    setUser(authUser);
    localStorage.setItem("isAuthenticated", "true");
    localStorage.setItem("userEmail", email);
    localStorage.setItem("userRole", role);
    localStorage.setItem("userName", name);

    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
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
