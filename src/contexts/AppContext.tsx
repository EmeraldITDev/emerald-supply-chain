import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { mrfApi, srfApi, rfqApi, quotationApi } from "@/services/api";
import type { MRF, SRF, RFQ as RFQType } from "@/types";

// Types
export interface ApprovalAction {
  stage: string;
  approver: string;
  action: "approved" | "rejected";
  remarks: string;
  timestamp: string;
}

export interface MRFRequest {
  id: string;
  title: string;
  category: string;
  description: string;
  quantity: string;
  estimatedCost: string;
  urgency: string;
  justification: string;
  status: string;
  date: string;
  requester: string;
  department?: string;
  // Approval workflow fields
  currentStage?: "submitted" | "procurement" | "executive" | "chairman" | "supply_chain" | "finance" | "approved" | "rejected" | "completed";
  procurementManagerApprovalTime?: string;
  approvalHistory?: ApprovalAction[];
  rejectionReason?: string;
  isResubmission?: boolean;
  // Document support
  documents?: string[]; // Array of base64 encoded documents
  // PO fields
  poNumber?: string;
  unsignedPOUrl?: string;
  signedPOUrl?: string;
  executiveComments?: string;
  chairmanComments?: string;
  supplyChainComments?: string;
  poRejectionReason?: string;
  poVersion?: number;
}

export interface SRFRequest {
  id: string;
  title: string;
  serviceType: string;
  description: string;
  duration: string;
  estimatedCost: string;
  urgency: string;
  justification: string;
  status: string;
  date: string;
  requester: string;
  // Document support
  documents?: string[]; // Array of base64 encoded documents
}

export interface PurchaseOrder {
  id: string;
  vendor: string;
  items: string;
  amount: string;
  status: string;
  date: string;
  deliveryDate: string;
}

export interface TripPassenger {
  id: string;
  name: string;
  email: string;
  department: string;
  pickupLocation?: string;
}

export interface Trip {
  id: string;
  route: string;
  vehicle: string;
  vehiclePlate?: string;
  vehicleType?: string;
  driver: string;
  driverEmail?: string;
  driverPhoto?: string;
  status: string;
  departure: string;
  arrival: string;
  cargo: string;
  passengers?: TripPassenger[];
  pickupLocation?: string;
  destination?: string;
  scheduledBy?: string;
  scheduledDate?: string;
}

export interface VehicleDocument {
  id: string;
  name: string;
  type: string;
  documentType: "registration" | "insurance" | "roadworthiness" | "other";
  fileData: string;
  uploadDate: string;
}

export interface Vehicle {
  id: string;
  name: string;
  type: string;
  plate: string;
  status: string;
  driver: string;
  lastMaintenance: string;
  // Vendor-registered vehicle fields
  vendorId?: string;
  vendorName?: string;
  approvalStatus?: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvalDate?: string;
  approvalNotes?: string;
  documents?: VehicleDocument[];
}

// Staff member designated as driver by Logistics
export interface StaffDriver {
  id: string;
  staffId: string;
  name: string;
  email: string;
  department: string;
  licenseNumber: string;
  licenseExpiry: string;
  status: "available" | "on-trip" | "off-duty";
  designatedBy: string;
  designatedDate: string;
  totalTrips: number;
  rating: number;
}

export interface VendorDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: string;
  fileData: string; // base64 encoded file data
}

export interface RFQ {
  id: string;
  mrfId: string;
  mrfTitle: string;
  description: string;
  quantity: string;
  estimatedCost: string;
  deadline: string;
  status: "Open" | "Closed" | "Awarded";
  createdDate: string;
  vendorIds: string[]; // Vendors invited to quote
}

export interface Quotation {
  id: string;
  rfqId: string;
  vendorId: string;
  vendorName: string;
  price: string;
  deliveryDate: string;
  notes: string;
  status: "Pending" | "Approved" | "Rejected";
  submittedDate: string;
  documentUrl?: string;
}

export interface VendorRegistration {
  id: string;
  companyName: string;
  category: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  contactPerson: string;
  status: "Pending" | "Approved" | "Rejected";
  submittedDate: string;
  reviewedDate?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  // Vehicle registrations for transport vendors
  vehicles?: {
    id: string;
    name: string;
    type: string;
    plate: string;
    documents: VehicleDocument[];
    approvalStatus: "pending" | "approved" | "rejected";
    approvedBy?: string;
    approvalDate?: string;
    approvalNotes?: string;
  }[];
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  rating: number;
  orders: number;
  status: string;
  kyc: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  contactPerson: string;
  documents: VendorDocument[];
}

// MRN (Materials Request Note) - Pre-MRF Request
export interface MRN {
  id: string;
  controlNumber: string;
  title: string;
  department: string;
  category: string;
  items: MRNItem[];
  urgency: "Low" | "Medium" | "High";
  justification: string;
  requesterId: string;
  requesterName: string;
  submittedDate: string;
  status: "Pending" | "Under Review" | "Converted to MRF" | "Rejected";
  reviewedBy?: string;
  reviewDate?: string;
  reviewNotes?: string;
  convertedMRFId?: string;
}

export interface MRNItem {
  name: string;
  description: string;
  quantity: string;
  estimatedUnitCost: string;
}

// Annual Procurement Plan
export interface AnnualProcurementPlan {
  id: string;
  year: number;
  department: string;
  submittedBy: string;
  submittedDate: string;
  status: "Draft" | "Submitted" | "Approved" | "Rejected";
  totalEstimatedBudget: string;
  items: AnnualPlanItem[];
  reviewedBy?: string;
  reviewDate?: string;
  reviewNotes?: string;
}

export interface AnnualPlanItem {
  category: string;
  itemDescription: string;
  estimatedQuantity: string;
  estimatedCost: string;
  priority: "High" | "Medium" | "Low";
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  justification: string;
}

interface AppContextType {
  // Read-only data from API (MRF, SRF, RFQ workflows)
  mrfRequests: MRFRequest[];
  srfRequests: SRFRequest[];
  rfqs: RFQ[];
  quotations: Quotation[];
  loading: boolean;
  
  // Local state data (Logistics, non-workflow)
  purchaseOrders: PurchaseOrder[];
  trips: Trip[];
  vehicles: Vehicle[];
  vendors: Vendor[];
  vendorRegistrations: VendorRegistration[];
  mrns: MRN[];
  annualPlans: AnnualProcurementPlan[];
  staffDrivers: StaffDriver[];
  
  // Logistics/Vehicle management functions (keep these)
  addPO: (po: Omit<PurchaseOrder, "id">) => void;
  updateTrip: (id: string, updates: Partial<Trip>) => void;
  addTrip: (trip: Omit<Trip, "id">) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  addVehicle: (vehicle: Omit<Vehicle, "id">) => void;
  approveVehicle: (vehicleId: string, approver: string, notes: string) => void;
  rejectVehicle: (vehicleId: string, approver: string, notes: string) => void;
  addVendor: (vendor: Omit<Vendor, "id" | "documents">) => void;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  addVendorDocument: (vendorId: string, document: Omit<VendorDocument, "id" | "uploadDate">) => void;
  deleteVendorDocument: (vendorId: string, documentId: string) => void;
  addVendorRegistration: (registration: Omit<VendorRegistration, "id" | "submittedDate" | "status">) => void;
  updateVendorRegistration: (id: string, updates: Partial<VendorRegistration>) => void;
  approveVendorRegistration: (id: string, approver: string, notes: string) => void;
  rejectVendorRegistration: (id: string, approver: string, notes: string) => void;
  addMRN: (mrn: Omit<MRN, "id" | "controlNumber" | "requesterId" | "requesterName" | "submittedDate" | "status">) => void;
  updateMRN: (id: string, updates: Partial<MRN>) => void;
  convertMRNToMRF: (mrnId: string, reviewerName: string) => void;
  addAnnualPlan: (plan: Omit<AnnualProcurementPlan, "id" | "submittedBy" | "submittedDate" | "status" | "totalEstimatedBudget">) => void;
  updateAnnualPlan: (id: string, updates: Partial<AnnualProcurementPlan>) => void;
  addStaffDriver: (driver: Omit<StaffDriver, "id" | "designatedDate" | "totalTrips" | "rating">) => void;
  updateStaffDriver: (id: string, updates: Partial<StaffDriver>) => void;
  removeStaffDriver: (id: string) => void;
  
  // Refresh functions to reload data from API
  refreshMRFs: () => Promise<void>;
  refreshSRFs: () => Promise<void>;
  refreshRFQs: () => Promise<void>;
  refreshQuotations: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  // API-backed state for workflows (read-only from context, modified via API)
  const [mrfRequests, setMrfRequests] = useState<MRFRequest[]>([]);
  const [srfRequests, setSrfRequests] = useState<SRFRequest[]>([]);
  const [rfqsState, setRfqsState] = useState<RFQ[]>([]);
  const [quotationsState, setQuotationsState] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch MRFs from API
  const refreshMRFs = async () => {
    try {
      const response = await mrfApi.getAll();
      if (response.success && response.data) {
        // Convert API MRF type to AppContext MRFRequest type
        const converted = response.data.map((mrf: MRF) => ({
          id: mrf.id,
          title: mrf.title,
          category: mrf.category,
          description: mrf.description,
          quantity: String(mrf.quantity),
          estimatedCost: String(mrf.estimated_cost || mrf.estimatedCost || 0),
          urgency: String(mrf.urgency).toLowerCase(),
          justification: mrf.justification,
          status: mrf.status,
          date: mrf.created_at || mrf.date || "",
          requester: mrf.requester_name || mrf.requester || "Unknown",
          department: mrf.department,
          currentStage: (mrf.current_stage || mrf.currentStage || "submitted") as any,
          approvalHistory: (mrf.approval_history || mrf.approvalHistory || []) as any,
          rejectionReason: mrf.rejection_reason || mrf.rejectionReason,
          isResubmission: mrf.is_resubmission || mrf.isResubmission,
          poNumber: mrf.po_number || mrf.poNumber,
          unsignedPOUrl: mrf.unsigned_po_url || mrf.unsignedPOUrl,
          signedPOUrl: mrf.signed_po_url || mrf.signedPOUrl,
          poVersion: mrf.po_version || mrf.poVersion || 1,
        }));
        setMrfRequests(converted);
      }
    } catch (error) {
      console.error("Failed to fetch MRFs:", error);
    }
  };

  // Fetch SRFs from API
  const refreshSRFs = async () => {
    try {
      const response = await srfApi.getAll();
      if (response.success && response.data) {
        // Convert API SRF type to AppContext SRFRequest type
        const converted = response.data.map((srf: any) => ({
          id: srf.id,
          title: srf.title,
          serviceType: srf.service_type || srf.serviceType || "",
          description: srf.description,
          duration: srf.duration || "",
          estimatedCost: String(srf.estimated_cost || srf.estimatedCost || 0),
          urgency: String(srf.urgency).toLowerCase(),
          justification: srf.justification,
          status: srf.status,
          date: srf.created_at || srf.date || "",
          requester: srf.requester_name || srf.requester || "Unknown",
        }));
        setSrfRequests(converted);
      }
    } catch (error) {
      console.error("Failed to fetch SRFs:", error);
    }
  };

  // Fetch RFQs from API
  const refreshRFQs = async () => {
    try {
      const response = await rfqApi.getAll();
      if (response.success && response.data) {
        // Convert API RFQ type to AppContext RFQ type
        const converted = response.data.map((rfq: any) => ({
          id: rfq.id,
          mrfId: rfq.mrf_id || rfq.mrfId || "",
          mrfTitle: rfq.title || rfq.mrfTitle || "",
          description: rfq.description,
          quantity: String(rfq.quantity || ""),
          estimatedCost: String(rfq.estimated_cost || rfq.estimatedCost || 0),
          deadline: rfq.deadline,
          status: rfq.status as "Open" | "Closed" | "Awarded",
          createdDate: rfq.created_at || rfq.createdAt || "",
          // Get vendorIds from API response instead of hardcoding []
          vendorIds: rfq.vendor_ids || rfq.vendorIds || rfq.vendors?.map((v: any) => v.id || v.vendor_id) || [],
        }));
        setRfqsState(converted);
      }
    } catch (error) {
      console.error("Failed to fetch RFQs:", error);
    }
  };

  // Fetch Quotations from API
  const refreshQuotations = async () => {
    try {
      const response = await quotationApi.getAll();
      if (response.success && response.data) {
        // Convert API Quotation type to AppContext Quotation type
        const converted = response.data.map((q: any) => ({
          id: q.id,
          rfqId: q.rfq_id || q.rfqId || "",
          vendorId: q.vendor_id || q.vendorId || "",
          vendorName: q.vendor?.name || q.vendor?.company_name || q.vendor_name || "Unknown Vendor",
          price: String(q.price || q.total_amount || q.amount || "0"),
          deliveryDate: q.delivery_date || q.deliveryDate || "",
          notes: q.notes || "",
          status: (q.status || "Pending") as "Pending" | "Approved" | "Rejected",
          submittedDate: q.submitted_date || q.submittedDate || q.submitted_at || q.submittedAt || q.created_at || q.createdAt || "",
          documentUrl: q.document_url || q.documentUrl,
          // Include additional fields for statistics and display
          deliveryDays: q.delivery_days || q.deliveryDays,
          delivery_days: q.delivery_days || q.deliveryDays,
          // Payment terms - include all variants
          paymentTerms: q.payment_terms || q.paymentTerms || q.payment_terms_text || "",
          payment_terms: q.payment_terms || q.paymentTerms || q.payment_terms_text || "",
          payment_terms_text: q.payment_terms || q.paymentTerms || q.payment_terms_text || "",
          // Additional fields that might be needed
          total_amount: q.total_amount || q.totalAmount || q.price || "0",
          totalAmount: q.total_amount || q.totalAmount || q.price || "0",
          currency: q.currency || "NGN",
          validity_days: q.validity_days || q.validityDays,
          warranty_period: q.warranty_period || q.warrantyPeriod,
        }));
        setQuotationsState(converted);
      }
    } catch (error) {
      console.error("Failed to fetch quotations:", error);
    }
  };

  // Initial data fetch
  useEffect(() => {
    // Check if we're in vendor portal context (vendor logged in but no regular user token)
    const regularToken = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const vendorToken = localStorage.getItem('vendorAuthToken') || sessionStorage.getItem('vendorAuthToken');
    
    // Only auto-refresh if we have a regular user token (not vendor-only)
    // Vendors should use vendor-specific endpoints instead (vendorPortalApi)
    if (regularToken || !vendorToken) {
      const fetchAllData = async () => {
        setLoading(true);
        await Promise.all([
          refreshMRFs(),
          refreshSRFs(),
          refreshRFQs(),
          refreshQuotations(),
        ]);
        setLoading(false);
      };
      
      fetchAllData();
    } else {
      // Vendor-only context - skip auto-refresh to avoid 401 errors
      // Vendors will fetch their own data via vendorPortalApi in VendorPortal component
      console.log("Vendor portal detected - skipping AppContext auto-refresh");
      setLoading(false);
    }
  }, []);

  // Purchase orders - empty by default, fetch from API
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  // Trips - fetch from API, no mock data
  const [trips, setTrips] = useState<Trip[]>(() => {
    const stored = localStorage.getItem("trips");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse stored trips", e);
      }
    }
    return []; // Empty by default - fetch from API
  });

  // Vehicles - fetch from API, no mock data
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const stored = localStorage.getItem("vehicles");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse stored vehicles", e);
      }
    }
    return []; // Empty by default - fetch from API
  });

  // Persist trips to localStorage
  React.useEffect(() => {
    localStorage.setItem("trips", JSON.stringify(trips));
  }, [trips]);

  // Persist vehicles to localStorage
  React.useEffect(() => {
    localStorage.setItem("vehicles", JSON.stringify(vehicles));
  }, [vehicles]);

  // Vendors - empty by default, fetch from API
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // Use the API-backed state defined above
  const rfqs = rfqsState;
  const quotations = quotationsState;

  // Vendor registrations - empty by default, fetch from API
  const [vendorRegistrations, setVendorRegistrations] = useState<VendorRegistration[]>([]);

  // MRF, SRF, RFQ CRUD functions removed - components should call API directly
  // Data is now read-only in context, fetched from API via refresh functions

  const addPO = (po: Omit<PurchaseOrder, "id">) => {
    const newPO: PurchaseOrder = {
      ...po,
      id: `PO-2025-${String(purchaseOrders.length + 1).padStart(3, "0")}`,
    };
    setPurchaseOrders([newPO, ...purchaseOrders]);
  };

  const updateTrip = (id: string, updates: Partial<Trip>) => {
    setTrips(trips.map((trip) => (trip.id === id ? { ...trip, ...updates } : trip)));
  };

  const addTrip = (trip: Omit<Trip, "id">) => {
    const newTrip: Trip = {
      ...trip,
      id: `TRP-${String(trips.length + 1).padStart(3, "0")}`,
    };
    setTrips([newTrip, ...trips]);
  };

  const updateVehicle = (id: string, updates: Partial<Vehicle>) => {
    setVehicles(vehicles.map((vehicle) => (vehicle.id === id ? { ...vehicle, ...updates } : vehicle)));
  };

  const addVehicle = (vehicle: Omit<Vehicle, "id">) => {
    const newVehicle: Vehicle = {
      ...vehicle,
      id: `VEH-${String(vehicles.length + 1).padStart(3, "0")}`,
    };
    setVehicles([newVehicle, ...vehicles]);
  };

  const approveVehicle = (vehicleId: string, approver: string, notes: string) => {
    setVehicles(vehicles.map((vehicle) => 
      vehicle.id === vehicleId 
        ? { 
            ...vehicle, 
            approvalStatus: "approved" as const,
            approvedBy: approver,
            approvalDate: new Date().toISOString(),
            approvalNotes: notes,
            status: "Active",
          } 
        : vehicle
    ));
  };

  const rejectVehicle = (vehicleId: string, approver: string, notes: string) => {
    setVehicles(vehicles.map((vehicle) => 
      vehicle.id === vehicleId 
        ? { 
            ...vehicle, 
            approvalStatus: "rejected" as const,
            approvedBy: approver,
            approvalDate: new Date().toISOString(),
            approvalNotes: notes,
            status: "Rejected",
          } 
        : vehicle
    ));
  };

  const addVendor = (vendor: Omit<Vendor, "id" | "documents">) => {
    const newVendor: Vendor = {
      ...vendor,
      id: `V${String(vendors.length + 1).padStart(3, "0")}`,
      documents: [],
    };
    setVendors([...vendors, newVendor]);
  };

  // RFQ and Quotation CRUD functions removed - use API directly

  const addVendorRegistration = (registration: Omit<VendorRegistration, "id" | "submittedDate" | "status">) => {
    const newRegistration: VendorRegistration = {
      ...registration,
      id: `VR-${String(vendorRegistrations.length + 1).padStart(3, "0")}`,
      status: "Pending",
      submittedDate: new Date().toISOString().split("T")[0],
    };
    setVendorRegistrations([newRegistration, ...vendorRegistrations]);
  };

  const updateVendorRegistration = (id: string, updates: Partial<VendorRegistration>) => {
    setVendorRegistrations(vendorRegistrations.map((reg) => (reg.id === id ? { ...reg, ...updates } : reg)));
  };

  const approveVendorRegistration = (id: string, approver: string, notes: string) => {
    const registration = vendorRegistrations.find(r => r.id === id);
    if (!registration) return;

    // Update registration status
    setVendorRegistrations(vendorRegistrations.map((reg) => 
      reg.id === id 
        ? { 
            ...reg, 
            status: "Approved" as const,
            reviewedBy: approver,
            reviewedDate: new Date().toISOString(),
            reviewNotes: notes,
          } 
        : reg
    ));

    // Create vendor from registration
    const newVendor: Vendor = {
      id: `V${String(vendors.length + 1).padStart(3, "0")}`,
      name: registration.companyName,
      category: registration.category,
      rating: 0,
      orders: 0,
      status: "Active",
      kyc: "Verified",
      email: registration.email,
      phone: registration.phone,
      address: registration.address,
      taxId: registration.taxId,
      contactPerson: registration.contactPerson,
      documents: [],
    };
    setVendors([...vendors, newVendor]);

    // Add any registered vehicles to the vehicles list (pending Logistics approval)
    if (registration.vehicles && registration.vehicles.length > 0) {
      const newVehicles = registration.vehicles.map((v, idx) => ({
        id: `VEH-${String(vehicles.length + idx + 1).padStart(3, "0")}`,
        name: v.name,
        type: v.type,
        plate: v.plate,
        status: "Pending Approval",
        driver: "",
        lastMaintenance: "",
        vendorId: newVendor.id,
        vendorName: newVendor.name,
        approvalStatus: "pending" as const,
        documents: v.documents,
      }));
      setVehicles([...vehicles, ...newVehicles]);
    }
  };

  const rejectVendorRegistration = (id: string, approver: string, notes: string) => {
    setVendorRegistrations(vendorRegistrations.map((reg) => 
      reg.id === id 
        ? { 
            ...reg, 
            status: "Rejected" as const,
            reviewedBy: approver,
            reviewedDate: new Date().toISOString(),
            reviewNotes: notes,
          } 
        : reg
    ));
  };

  const updateVendor = (id: string, updates: Partial<Vendor>) => {
    setVendors(vendors.map((vendor) => (vendor.id === id ? { ...vendor, ...updates } : vendor)));
  };

  const addVendorDocument = (vendorId: string, document: Omit<VendorDocument, "id" | "uploadDate">) => {
    setVendors(
      vendors.map((vendor) =>
        vendor.id === vendorId
          ? {
              ...vendor,
              documents: [
                ...vendor.documents,
                {
                  ...document,
                  id: `DOC-${Date.now()}`,
                  uploadDate: new Date().toISOString(),
                },
              ],
            }
          : vendor
      )
    );
  };

  const deleteVendorDocument = (vendorId: string, documentId: string) => {
    setVendors(
      vendors.map((vendor) =>
        vendor.id === vendorId
          ? {
              ...vendor,
              documents: vendor.documents.filter((doc) => doc.id !== documentId),
            }
          : vendor
      )
    );
  };

  // MRN Management
  const [mrns, setMrns] = useState<MRN[]>([]);
  
  // Counter for MRN control numbers
  const [mrnCounter, setMrnCounter] = useState(() => {
    const stored = localStorage.getItem("mrnCounter");
    return stored ? parseInt(stored) : 1;
  });

  const addMRN = (mrn: Omit<MRN, "id" | "controlNumber" | "requesterId" | "requesterName" | "submittedDate" | "status">) => {
    const userId = localStorage.getItem("userEmail") || "unknown";
    const userName = localStorage.getItem("userName") || "Unknown User";
    
    const newMRN: MRN = {
      ...mrn,
      id: `MRN-${Date.now()}`,
      controlNumber: `MRN-${new Date().getFullYear()}-${String(mrnCounter).padStart(4, "0")}`,
      requesterId: userId,
      requesterName: userName,
      submittedDate: new Date().toISOString(),
      status: "Pending",
    };
    
    setMrns([newMRN, ...mrns]);
    const newCounter = mrnCounter + 1;
    setMrnCounter(newCounter);
    localStorage.setItem("mrnCounter", newCounter.toString());
  };

  const updateMRN = (id: string, updates: Partial<MRN>) => {
    setMrns(mrns.map((mrn) => (mrn.id === id ? { ...mrn, ...updates } : mrn)));
  };

  const convertMRNToMRF = (mrnId: string, reviewerName: string) => {
    const mrn = mrns.find(m => m.id === mrnId);
    if (!mrn) return;

    // Calculate total estimated cost
    const totalCost = mrn.items.reduce((sum, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const unitCost = parseFloat(item.estimatedUnitCost) || 0;
      return sum + (quantity * unitCost);
    }, 0);

    // Create MRF from MRN - goes directly to Executive for approval
    const newMRF: MRFRequest = {
      id: `MRF-${new Date().getFullYear()}-${String(mrfRequests.length + 1).padStart(3, "0")}`,
      title: mrn.title,
      category: mrn.category,
      description: `Converted from ${mrn.controlNumber}: ${mrn.items.map(i => i.name).join(", ")}`,
      quantity: mrn.items.length.toString(),
      estimatedCost: totalCost.toString(),
      urgency: mrn.urgency.toLowerCase() as "high" | "medium" | "low",
      justification: mrn.justification,
      status: "Pending Executive Approval",
      date: new Date().toISOString().split("T")[0],
      requester: mrn.requesterName,
      department: mrn.department,
      currentStage: "executive",
      approvalHistory: [],
    };

    setMrfRequests([newMRF, ...mrfRequests]);
    
    // Update MRN status
    updateMRN(mrnId, {
      status: "Converted to MRF",
      reviewedBy: reviewerName,
      reviewDate: new Date().toISOString(),
      convertedMRFId: newMRF.id,
    });
  };

  // Annual Plan Management
  const [annualPlans, setAnnualPlans] = useState<AnnualProcurementPlan[]>([]);

  const addAnnualPlan = (plan: Omit<AnnualProcurementPlan, "id" | "submittedBy" | "submittedDate" | "status" | "totalEstimatedBudget">) => {
    const userName = localStorage.getItem("userName") || "Unknown User";
    
    const totalBudget = plan.items.reduce((sum, item) => 
      sum + (parseFloat(item.estimatedCost) || 0), 0
    );

    const newPlan: AnnualProcurementPlan = {
      ...plan,
      id: `APP-${Date.now()}`,
      submittedBy: userName,
      submittedDate: new Date().toISOString(),
      status: "Submitted",
      totalEstimatedBudget: totalBudget.toString(),
    };
    
    setAnnualPlans([newPlan, ...annualPlans]);
  };

  const updateAnnualPlan = (id: string, updates: Partial<AnnualProcurementPlan>) => {
    setAnnualPlans(annualPlans.map((plan) => (plan.id === id ? { ...plan, ...updates } : plan)));
  };

  // Staff Drivers Management - empty by default, fetch from API
  const [staffDrivers, setStaffDrivers] = useState<StaffDriver[]>(() => {
    const stored = localStorage.getItem("staffDrivers");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse stored staffDrivers", e);
      }
    }
    return []; // Empty by default - fetch from API
  });

  // Persist staffDrivers to localStorage
  React.useEffect(() => {
    localStorage.setItem("staffDrivers", JSON.stringify(staffDrivers));
  }, [staffDrivers]);

  const addStaffDriver = (driver: Omit<StaffDriver, "id" | "designatedDate" | "totalTrips" | "rating">) => {
    const newDriver: StaffDriver = {
      ...driver,
      id: `DRV-${String(staffDrivers.length + 1).padStart(3, "0")}`,
      designatedDate: new Date().toISOString().split("T")[0],
      totalTrips: 0,
      rating: 0,
    };
    setStaffDrivers([newDriver, ...staffDrivers]);
  };

  const updateStaffDriver = (id: string, updates: Partial<StaffDriver>) => {
    setStaffDrivers(staffDrivers.map((driver) => (driver.id === id ? { ...driver, ...updates } : driver)));
  };

  const removeStaffDriver = (id: string) => {
    setStaffDrivers(staffDrivers.filter((driver) => driver.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        // API-backed workflow data (read-only)
        mrfRequests,
        srfRequests,
        rfqs,
        quotations,
        loading,
        
        // Local state data
        purchaseOrders,
        trips,
        vehicles,
        vendors,
        vendorRegistrations,
        mrns,
        annualPlans,
        staffDrivers,
        
        // Logistics/Vehicle management functions
        addPO,
        updateTrip,
        addTrip,
        updateVehicle,
        addVehicle,
        approveVehicle,
        rejectVehicle,
        addVendor,
        updateVendor,
        addVendorDocument,
        deleteVendorDocument,
        addVendorRegistration,
        updateVendorRegistration,
        approveVendorRegistration,
        rejectVendorRegistration,
        addMRN,
        updateMRN,
        convertMRNToMRF,
        addAnnualPlan,
        updateAnnualPlan,
        addStaffDriver,
        updateStaffDriver,
        removeStaffDriver,
        
        // API refresh functions
        refreshMRFs,
        refreshSRFs,
        refreshRFQs,
        refreshQuotations,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
};
