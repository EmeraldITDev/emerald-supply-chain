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

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Procurement", href: "/procurement", icon: ShoppingCart },
    { name: "Logistics", href: "/logistics", icon: Truck },
    { name: "Inventory", href: "/inventory", icon: Package },
    { name: "Warehouse", href: "/warehouse", icon: Warehouse },
    { name: "Vendors", href: "/vendors", icon: Users },
    { name: "Reports", href: "/reports", icon: FileText },
  ];

  const handleLogout = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("userEmail");
    navigate("/auth");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-card border-r transition-all duration-300",
          sidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-semibold text-lg">SCM</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="mx-auto"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-3 space-y-1">
          <Link
            to="/settings"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Settings className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span>Settings</span>}
          </Link>
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full",
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={cn(
          "flex-1 flex flex-col transition-all duration-300",
          sidebarOpen ? "ml-64" : "ml-20"
        )}
      >
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-card px-6">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Supply Chain Management</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {localStorage.getItem("userEmail")}
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
