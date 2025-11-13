import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationCenter } from "@/components/NotificationCenter";
import { AIChatbot } from "@/components/AIChatbot";

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
          <header className="sticky top-0 z-40 flex h-14 sm:h-16 items-center gap-2 sm:gap-4 border-b bg-card px-3 sm:px-4 lg:px-6">
            <SidebarTrigger />
            
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <Breadcrumbs />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
              <GlobalSearch />
              <NotificationCenter />
              <ThemeToggle />
              
              <div className="hidden md:block text-right border-l pl-2 lg:pl-3 ml-1 lg:ml-2">
                <p className="text-xs lg:text-sm font-medium truncate max-w-[100px] lg:max-w-[160px]">
                  {user?.name}
                </p>
                <p className="text-xs text-muted-foreground truncate max-w-[100px] lg:max-w-[160px]">
                  {user?.role && user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                </p>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 xl:p-8">{children}</main>
        </div>
      </div>
      
      {/* AI Chatbot */}
      <AIChatbot />
    </SidebarProvider>
  );
};

export default DashboardLayout;
