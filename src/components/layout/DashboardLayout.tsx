import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationCenter } from "@/components/NotificationCenter";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user } = useAuth();

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col w-full">
          {/* Header */}
          <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6">
            <SidebarTrigger />
            
            <div className="flex-1 flex items-center gap-4">
              <Breadcrumbs />
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <GlobalSearch />
              <NotificationCenter />
              <ThemeToggle />
              
              <div className="hidden sm:block text-right border-l pl-3">
                <p className="text-xs md:text-sm font-medium truncate max-w-[120px] md:max-w-none">
                  {user?.name}
                </p>
                <p className="text-xs text-muted-foreground truncate max-w-[120px] md:max-w-none">
                  {user?.role && user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </p>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
