import { lazy } from "react";
import { safeLazyImport } from "@/utils/safeLazyImport";

/** Route-level code splitting — heavy dashboards and modules load on demand. */
const lazyPage = <T extends { default: React.ComponentType<any> }>(
  loader: () => Promise<T>,
) => lazy(() => safeLazyImport(loader));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type React from "react";

export const Dashboard = lazyPage(() => import("@/pages/Dashboard"));
export const DepartmentDashboard = lazyPage(() => import("@/pages/DepartmentDashboard"));
export const ExecutiveDashboard = lazyPage(() => import("@/pages/ExecutiveDashboard"));
export const ChairmanDashboard = lazyPage(() => import("@/pages/ChairmanDashboard"));
export const SupplyChainDashboard = lazyPage(() => import("@/pages/SupplyChainDashboard"));
export const Procurement = lazyPage(() => import("@/pages/Procurement"));
export const NewMRF = lazyPage(() => import("@/pages/NewMRF"));
export const NewMRN = lazyPage(() => import("@/pages/NewMRN"));
export const MRNDetail = lazyPage(() => import("@/pages/MRNDetail"));
export const NewAnnualPlan = lazyPage(() => import("@/pages/NewAnnualPlan"));
export const NewSRF = lazyPage(() => import("@/pages/NewSRF"));
export const Logistics = lazyPage(() => import("@/pages/Logistics"));
export const Inventory = lazyPage(() => import("@/pages/Inventory"));
export const Warehouse = lazyPage(() => import("@/pages/Warehouse"));
export const Vendors = lazyPage(() => import("@/pages/Vendors"));
export const VendorRegistrationReview = lazyPage(() => import("@/pages/VendorRegistrationReview"));
export const Reports = lazyPage(() => import("@/pages/Reports"));
export const ProcurementReports = lazyPage(() => import("@/pages/ProcurementReports"));
export const TripRequest = lazyPage(() => import("@/pages/TripRequest"));
export const AllTrips = lazyPage(() => import("@/pages/AllTrips"));
export const Settings = lazyPage(() => import("@/pages/Settings"));
export const UserManagement = lazyPage(() => import("@/pages/UserManagement"));
export const AccountsPayable = lazyPage(() => import("@/pages/AccountsPayable"));
export const AccountsReceivable = lazyPage(() => import("@/pages/AccountsReceivable"));
export const BudgetControl = lazyPage(() => import("@/pages/BudgetControl"));
export const Projects = lazyPage(() => import("@/pages/Projects"));
export const VendorPortal = lazyPage(() => import("@/pages/VendorPortal"));
export const VendorRegistrationSuccess = lazyPage(() => import("@/pages/VendorRegistrationSuccess"));
export const MRFDetailPage = lazyPage(() => import("@/pages/details/MRFDetailPage"));
export const PODetailPage = lazyPage(() => import("@/pages/details/PODetailPage"));
export const RFQDetailPage = lazyPage(() => import("@/pages/details/RFQDetailPage"));
export const TripDetailPage = lazyPage(() => import("@/pages/details/TripDetailPage"));
export const TripRequestDetailPage = lazyPage(() => import("@/pages/details/TripRequestDetailPage"));
export const FleetDetailPage = lazyPage(() => import("@/pages/details/FleetDetailPage"));
export const DriverDetailPage = lazyPage(() => import("@/pages/details/DriverDetailPage"));
export const VendorDetailPage = lazyPage(() => import("@/pages/details/VendorDetailPage"));
export const MaintenanceDetailPage = lazyPage(() => import("@/pages/details/MaintenanceDetailPage"));
