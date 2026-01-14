import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationCenter } from "@/components/NotificationCenter";
import { AIChatbot } from "@/components/AIChatbot";
import { useNavigate } from "react-router-dom";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleUserClick = () => {
    navigate('/settings');
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col w-full">
          {/* Header */}
          <header className="sticky top-0 z-40 border-b bg-card">
            <div className="flex h-14 sm:h-16 items-center gap-2 sm:gap-4 px-3 sm:px-4 lg:px-6">
              <SidebarTrigger className="shrink-0" />
              
              <div className="hidden md:flex flex-1 items-center gap-2 min-w-0 overflow-hidden">
                <Breadcrumbs />
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 ml-auto">
                <GlobalSearch />
                <NotificationCenter />
                <ThemeToggle />
                
                <button
                  onClick={handleUserClick}
                  className="hidden lg:block text-right border-l pl-2 lg:pl-3 ml-1 lg:ml-2 hover:bg-accent/50 rounded-md px-2 py-1 transition-colors cursor-pointer"
                  title="Click to open profile settings"
                >
                  <p className="text-xs lg:text-sm font-medium truncate max-w-[100px] lg:max-w-[160px]">
                    {user?.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[100px] lg:max-w-[160px]">
                    {user?.role && user.role.charAt(0).toUpperCase() + user.role.slice(1).replace('_', ' ')}
                  </p>
                </button>
              </div>
            </div>
            
            {/* Mobile Breadcrumbs - Below header on small screens */}
            <div className="md:hidden px-3 pb-2 overflow-x-auto">
              <Breadcrumbs />
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
