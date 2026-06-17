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
  BarChart3,
  Calendar,
  MapPin,
  Route,
} from "lucide-react";
import { canCreateTripRequest } from "@/utils/tripRequestAccess";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth, isEmployeeRole } from "@/contexts/AuthContext";
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
import { getScmRole, formatScmRoleLabel } from "@/utils/scmRole";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { open } = useSidebar();

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const tripRequestNavItem = canCreateTripRequest(getScmRole(user))
    ? [{ title: "Trip Request", url: "/trip-request", icon: MapPin }]
    : [];

  const allTripsNavItem = { title: "All Trips", url: "/trips", icon: Route };

  const travelNavSection = {
    label: "Travel",
    items: [allTripsNavItem, ...tripRequestNavItem],
  };

  // Full procurement navigation (shared by Procurement, Executive, Chairman, Supply Chain Director)
  const fullProcurementNav = [
    {
      label: "Main",
      items: [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      ]
    },
    travelNavSection,
    {
      label: "Operations",
      items: [
        { 
          title: "Procurement", 
          url: "/procurement", 
          icon: ShoppingCart,
          subItems: [
            { title: "Overview", url: "/procurement" },
            // MRF/SRF creation removed - only employees can create via Department Dashboard
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
        { title: "Procurement Reports", url: "/reports/procurement", icon: BarChart3 },
      ]
    }
  ];

  // Role-based navigation structure
  const getNavigationGroups = () => {
    if (isEmployeeRole(getScmRole(user))) {
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
            { title: "My Requests", url: "/department", icon: FileText },
            { title: "New MRF", url: "/new-mrf", icon: FileText },
            { title: "New SRF", url: "/new-srf", icon: FileText },
            { title: "Trip Request", url: "/trip-request", icon: MapPin },
            { title: "Annual Planning", url: "/department?tab=annual", icon: Calendar },
          ]
        },
        travelNavSection,
      ];
    } else if (getScmRole(user) === "procurement" || getScmRole(user) === "procurement_manager") {
      // Procurement Manager: Full system, no approvals
      return fullProcurementNav;
    } else if (getScmRole(user) === "finance") {
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
        travelNavSection,
        {
          label: "Analytics",
          items: [
            { title: "Reports", url: "/reports", icon: FileText },
            { title: "Procurement Reports", url: "/reports/procurement", icon: BarChart3 },
          ]
        }
      ];
    } else if (getScmRole(user) === "executive") {
      // Executive: Full procurement access + MRF approval authority
      return [
        ...fullProcurementNav,
        {
          label: "Approvals",
          items: [
            { title: "MRF Approvals", url: "/executive", icon: FileText },
          ]
        }
      ];
    } else if (getScmRole(user) === "chairman") {
      // Chairman: Full procurement access + high-value MRF & payment approvals
      return [
        ...fullProcurementNav,
        {
          label: "Approvals",
          items: [
            { title: "High-Value MRFs", url: "/chairman", icon: FileText },
            { title: "Payment Approvals", url: "/chairman", icon: DollarSign },
          ]
        }
      ];
    } else if (getScmRole(user) === "supply_chain_director" || getScmRole(user) === "supply_chain") {
      // Supply Chain Director: Full procurement access + PO signing
      // Note: Database may use "supply_chain" or "supply_chain_director" for this role
      return [
        ...fullProcurementNav,
        {
          label: "PO Management",
          items: [
            { title: "Sign Purchase Orders", url: "/supply-chain", icon: FileText },
          ]
        }
      ];
    } else if (getScmRole(user) === "logistics_manager") {
      // Logistics Manager: full logistics ops + create own MRF/SRF + read-only procurement
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
            { title: "My Requests", url: "/department", icon: FileText },
            { title: "New MRF", url: "/new-mrf", icon: FileText },
            { title: "New SRF", url: "/new-srf", icon: FileText },
            { title: "Trip Request", url: "/trip-request", icon: MapPin },
            { title: "Annual Planning", url: "/department?tab=annual", icon: Calendar },
          ]
        },
        travelNavSection,
        {
          label: "Operations",
          items: [
            { title: "Logistics", url: "/logistics", icon: Truck },
            { title: "Vendors", url: "/vendors", icon: Users },
            { title: "Inventory", url: "/inventory", icon: Package },
          ]
        },
        {
          label: "Procurement",
          items: [
            { title: "Procurement Overview", url: "/procurement", icon: ShoppingCart },
          ]
        },
        {
          label: "Analytics",
          items: [
            { title: "Reports", url: "/reports", icon: FileText },
          ]
        }
      ];
    } else if (getScmRole(user) === "logistics" || getScmRole(user) === "logistics_officer") {
      return [
        {
          label: "Main",
          items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
        },
        travelNavSection,
        {
          label: "Operations",
          items: [
            { title: "Logistics", url: "/logistics", icon: Truck },
            { title: "Vendors", url: "/vendors", icon: Users },
          ],
        },
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
