import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserRole = "employee" | "procurement" | "finance" | "executive" | "supply_chain_director" | "chairman" | "logistics";

export interface AuthUser {
  email: string;
  role: UserRole;
  name: string;
  department: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Role mapping based on email
const getRoleFromEmail = (email: string): { role: UserRole; name: string; department: string } => {
  if (email.includes("bunmi.babajide@emeraldcfze.com")) {
    return { role: "executive", name: "Bunmi Babajide", department: "Executive" };
  } else if (email.includes("laa@emeraldcfze.com")) {
    return { role: "chairman", name: "Company Chairman", department: "Executive" };
  } else if (email.includes("supply@emeraldcfze.com") || email.includes("supplychain@emeraldcfze.com")) {
    return { role: "supply_chain_director", name: "Supply Chain Director", department: "Supply Chain" };
  } else if (email.includes("logistics@emeraldcfze.com")) {
    return { role: "logistics", name: "Logistics Manager", department: "Logistics" };
  } else if (email.includes("procurement@emeraldcfze.com")) {
    return { role: "procurement", name: "Procurement Manager", department: "Procurement" };
  } else if (email.includes("finance@emeraldcfze.com") || email.includes("temitope")) {
    return { role: "finance", name: "Temitope Lawal", department: "Finance" };
  } else if (email.includes("staff@emeraldcfze.com")) {
    return { role: "employee", name: "Employee User", department: "General Staff" };
  }
  return { role: "employee", name: "Guest User", department: "General" };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Check for existing session
    const storedEmail = localStorage.getItem("userEmail");
    const storedRole = localStorage.getItem("userRole") as UserRole;
    const storedName = localStorage.getItem("userName");
    const storedDepartment = localStorage.getItem("userDepartment");
    
    if (storedEmail && storedRole && storedName && storedDepartment) {
      setUser({ email: storedEmail, role: storedRole, name: storedName, department: storedDepartment });
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Simple validation
    if (!email || !password) {
      return false;
    }

    const { role, name, department } = getRoleFromEmail(email);
    
    const authUser: AuthUser = {
      email,
      role,
      name,
      department,
    };

    setUser(authUser);
    localStorage.setItem("isAuthenticated", "true");
    localStorage.setItem("userEmail", email);
    localStorage.setItem("userRole", role);
    localStorage.setItem("userName", name);
    localStorage.setItem("userDepartment", department);

    return true;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    localStorage.removeItem("userDepartment");
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
