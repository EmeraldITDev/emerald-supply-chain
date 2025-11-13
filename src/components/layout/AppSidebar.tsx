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
  ChevronRight,
  FolderKanban,
  Receipt,
  DollarSign,
  BarChart3
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import logo from "@/assets/emerald-logo.png";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { open } = useSidebar();

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  // Role-based navigation structure
  const getNavigationGroups = () => {
    if (user?.role === "employee") {
      return [
        {
          label: "Main",
          items: [
            { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
          ]
        },
        {
          label: "Requests",
          items: [
            { title: "My Requests", url: "/dashboard", icon: FileText },
          ]
        }
      ];
    } else if (user?.role === "procurement") {
      return [
        {
          label: "Main",
          items: [
            { title: "Dashboard", url: "/procurement", icon: LayoutDashboard },
          ]
        },
        {
          label: "Operations",
          items: [
            { 
              title: "Procurement", 
              url: "/procurement", 
              icon: ShoppingCart,
              subItems: [
                { title: "Overview", url: "/procurement" },
                { title: "New MRF", url: "/new-mrf" },
                { title: "New SRF", url: "/new-srf" },
              ]
            },
            { title: "Vendors", url: "/vendors", icon: Users },
            { title: "Logistics", url: "/logistics", icon: Truck },
            { title: "Inventory", url: "/inventory", icon: Package },
            { title: "Warehouse", url: "/warehouse", icon: Warehouse },
          ]
        },
        {
          label: "Analytics",
          items: [
            { title: "Reports", url: "/reports", icon: FileText },
          ]
        }
      ];
    } else if (user?.role === "finance") {
      return [
        {
          label: "Main",
          items: [
            { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
          ]
        },
        {
          label: "Finance",
          items: [
            { title: "Accounts Payable", url: "/accounts-payable", icon: Receipt },
            { title: "Accounts Receivable", url: "/accounts-receivable", icon: DollarSign },
            { title: "Budget Control", url: "/budget", icon: BarChart3 },
          ]
        },
        {
          label: "Analytics",
          items: [
            { title: "Reports", url: "/reports", icon: FileText },
          ]
        }
      ];
    } else if (user?.role === "executive") {
      return [
        {
          label: "Main",
          items: [
            { title: "Dashboard", url: "/executive", icon: LayoutDashboard },
          ]
        },
        {
          label: "Approvals",
          items: [
            { title: "MRF Approvals", url: "/executive", icon: FileText },
          ]
        }
      ];
    } else if (user?.role === "chairman") {
      return [
        {
          label: "Main",
          items: [
            { title: "Dashboard", url: "/chairman", icon: LayoutDashboard },
          ]
        },
        {
          label: "Approvals",
          items: [
            { title: "High-Value MRFs", url: "/chairman", icon: FileText },
            { title: "Payment Approvals", url: "/chairman", icon: DollarSign },
          ]
        }
      ];
    } else if (user?.role === "supply_chain_director") {
      return [
        {
          label: "Main",
          items: [
            { title: "Dashboard", url: "/supply-chain", icon: LayoutDashboard },
          ]
        },
        {
          label: "Operations",
          items: [
            { title: "Purchase Orders", url: "/supply-chain", icon: FileText },
            { title: "Logistics", url: "/logistics", icon: Truck },
            { title: "Warehouse", url: "/warehouse", icon: Warehouse },
          ]
        }
      ];
    }
    return [];
  };

  const navigationGroups = getNavigationGroups();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <img src={logo} alt="Emerald Industrial" className="h-8 w-8 object-contain" />
          {open && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">Emerald SCM</span>
              <span className="text-xs text-sidebar-foreground/60">Supply Chain ERP</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigationGroups.map((group, idx) => (
          <SidebarGroup key={idx}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  if (item.subItems) {
                    return (
                      <Collapsible key={item.title} asChild defaultOpen={false}>
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton>
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                              <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.subItems.map((subItem) => (
                                <SidebarMenuSubItem key={subItem.url}>
                                  <SidebarMenuSubButton asChild>
                                    <NavLink to={subItem.url} end>
                                      {subItem.title}
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/settings">
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
