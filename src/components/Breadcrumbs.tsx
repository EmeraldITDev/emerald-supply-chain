import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  department: "My Requests",
  executive: "Executive Dashboard",
  chairman: "Chairman Dashboard",
  "supply-chain": "Supply Chain",
  procurement: "Procurement",
  vendors: "Vendors",
  logistics: "Logistics",
  inventory: "Inventory",
  warehouse: "Warehouse",
  reports: "Reports",
  settings: "Settings",
  mrn: "Material Requests",
  mrf: "Material Requisition",
  srf: "Service Requisition",
  "annual-plan": "Annual Plan",
  new: "New",
  "new-mrf": "New Material Request",
  "new-srf": "New Service Request",
  "accounts-payable": "Accounts Payable",
  "accounts-receivable": "Accounts Receivable",
  budget: "Budget Control",
  projects: "Project Tracking",
  analytics: "Analytics",
  "vendor-portal": "Vendor Portal",
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split("/").filter((x) => x);

  if (pathnames.length === 0) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem className="shrink-0">
          <BreadcrumbLink asChild>
            <Link to="/dashboard" className="flex items-center gap-1">
              <Home className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="sr-only">Dashboard</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        {pathnames.map((pathname, index) => {
          const routeTo = `/${pathnames.slice(0, index + 1).join("/")}`;
          const isLast = index === pathnames.length - 1;
          
          // Check if this is a dynamic ID (like MRN-123 or MRF-123)
          const isDynamicId = pathname.match(/^[A-Z]+-\d+/) || pathname.match(/^\d+$/);
          
          // For dynamic IDs on the last segment, show abbreviated version
          let label = routeLabels[pathname] || pathname.charAt(0).toUpperCase() + pathname.slice(1);
          if (isDynamicId && isLast) {
            label = pathname.length > 20 ? pathname.substring(0, 17) + "..." : pathname;
          } else if (isDynamicId) {
            label = "Details";
          }

          return (
            <span key={routeTo} className="flex items-center shrink-0">
              <BreadcrumbSeparator>
                <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
              </BreadcrumbSeparator>
              <BreadcrumbItem className="shrink-0">
                {isLast ? (
                  <BreadcrumbPage className="max-w-[120px] sm:max-w-[200px] truncate text-xs sm:text-sm">{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={routeTo} className="max-w-[120px] sm:max-w-[200px] truncate text-xs sm:text-sm">{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
