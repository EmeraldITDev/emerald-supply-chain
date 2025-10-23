import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Truck,
  Warehouse,
  ShoppingCart,
  Users,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/emerald-logo.png";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Role-based navigation
  const getNavigation = () => {
    if (user?.role === "employee") {
      return [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      ];
    } else if (user?.role === "procurement") {
      return [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Procurement", href: "/procurement", icon: ShoppingCart },
        { name: "Vendors", href: "/vendors", icon: Users },
        { name: "Logistics", href: "/logistics", icon: Truck },
        { name: "Inventory", href: "/inventory", icon: Package },
        { name: "Warehouse", href: "/warehouse", icon: Warehouse },
        { name: "Reports", href: "/reports", icon: FileText },
      ];
    } else if (user?.role === "finance") {
      return [
        { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { name: "Reports", href: "/reports", icon: FileText },
      ];
    }
    return [];
  };

  const navigation = getNavigation();

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r transition-all duration-300",
          "md:relative",
          // Mobile: slide in/out
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // Desktop: expand/collapse
          sidebarOpen ? "w-64" : "w-20",
          "md:w-64 md:block"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b">
          <img src={logo} alt="Emerald Industrial" className="h-10 object-contain" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setMobileMenuOpen(false);
              setSidebarOpen(!sidebarOpen);
            }}
            className="hidden md:flex"
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className={cn(sidebarOpen ? "block" : "hidden md:block")}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3 space-y-1">
          <Link
            to="/settings"
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Settings className="h-5 w-5 flex-shrink-0" />
            <span className={cn(sidebarOpen ? "block" : "hidden md:block")}>Settings</span>
          </Link>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              handleLogout();
            }}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className={cn(sidebarOpen ? "block" : "hidden md:block")}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col w-full md:w-auto">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-base md:text-lg font-semibold truncate">Supply Chain Management</h2>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="text-right">
              <p className="text-xs md:text-sm font-medium truncate max-w-[120px] md:max-w-none">
                {user?.name}
              </p>
              <p className="text-xs text-muted-foreground truncate max-w-[120px] md:max-w-none">
                {user?.role && user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
