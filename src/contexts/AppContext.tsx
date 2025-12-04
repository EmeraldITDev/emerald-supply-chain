import React, { createContext, useContext, useState, ReactNode } from "react";

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
  mrfRequests: MRFRequest[];
  srfRequests: SRFRequest[];
  purchaseOrders: PurchaseOrder[];
  trips: Trip[];
  vehicles: Vehicle[];
  vendors: Vendor[];
  rfqs: RFQ[];
  quotations: Quotation[];
  vendorRegistrations: VendorRegistration[];
  mrns: MRN[];
  annualPlans: AnnualProcurementPlan[];
  staffDrivers: StaffDriver[];
  addMRF: (mrf: Omit<MRFRequest, "id" | "status" | "date" | "requester">) => void;
  updateMRF: (id: string, updates: Partial<MRFRequest>) => void;
  approveMRF: (id: string, stage: string, approver: string, remarks: string) => void;
  rejectMRF: (id: string, stage: string, approver: string, remarks: string) => void;
  addSRF: (srf: Omit<SRFRequest, "id" | "status" | "date" | "requester">) => void;
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
  addRFQ: (rfq: Omit<RFQ, "id" | "createdDate">) => void;
  updateRFQ: (id: string, updates: Partial<RFQ>) => void;
  addQuotation: (quotation: Omit<Quotation, "id" | "submittedDate">) => void;
  updateQuotation: (id: string, updates: Partial<Quotation>) => void;
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  // Load initial data from localStorage or use defaults
  const [mrfRequests, setMrfRequests] = useState<MRFRequest[]>(() => {
    const stored = localStorage.getItem("mrfRequests");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse stored MRF requests", e);
      }
    }
    return [
      {
        id: "MRF-2025-001",
        title: "Office Supplies",
        category: "office-supplies",
        description: "Stationery and office materials",
        quantity: "50",
        estimatedCost: "25000",
        urgency: "medium",
        justification: "Regular office operations",
        status: "Submitted",
        date: "2025-10-14",
        requester: "Current User",
        currentStage: "procurement",
        procurementManagerApprovalTime: "2025-10-14T08:00:00Z",
        approvalHistory: [],
      },
      {
        id: "MRF-2025-002",
        title: "Raw Materials",
        category: "raw-materials",
        description: "Production materials for Q4",
        quantity: "200",
        estimatedCost: "500000",
        urgency: "high",
        justification: "Production schedule requirements",
        status: "Finance Approved",
        date: "2025-10-13",
        requester: "Jane Smith",
        currentStage: "chairman",
        procurementManagerApprovalTime: "2025-10-13T09:00:00Z",
        approvalHistory: [
          {
            stage: "procurement",
            approver: "Procurement Manager",
            action: "approved",
            remarks: "Approved for production needs",
            timestamp: "2025-10-13T10:00:00Z",
          },
          {
            stage: "finance",
            approver: "Finance Manager",
            action: "approved",
            remarks: "Budget allocated",
            timestamp: "2025-10-14T11:00:00Z",
          },
        ],
      },
      {
        id: "MRF-2025-003",
        title: "Marketing Materials",
        category: "office-supplies",
        description: "Brochures and promotional materials",
        quantity: "100",
        estimatedCost: "35000",
        urgency: "low",
        justification: "Upcoming marketing campaign",
        status: "Rejected",
        date: "2025-10-12",
        requester: "Current User",
        currentStage: "rejected",
        procurementManagerApprovalTime: "2025-10-12T08:00:00Z",
        rejectionReason: "Budget not allocated for marketing materials in Q4. Please revise with lower cost estimate or defer to next quarter.",
        approvalHistory: [
          {
            stage: "procurement",
            approver: "Procurement Manager",
            action: "rejected",
            remarks: "Budget not allocated for marketing materials in Q4. Please revise with lower cost estimate or defer to next quarter.",
            timestamp: "2025-10-12T10:00:00Z",
          },
        ],
      },
    ];
  });

  const [srfRequests, setSrfRequests] = useState<SRFRequest[]>(() => {
    const stored = localStorage.getItem("srfRequests");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse stored SRF requests", e);
      }
    }
    return [
      {
        id: "SRF-2025-001",
        title: "Maintenance Service",
        serviceType: "maintenance",
        description: "Equipment maintenance",
        duration: "2 weeks",
        estimatedCost: "75000",
        urgency: "medium",
        justification: "Scheduled maintenance",
        status: "Pending",
        date: "2025-10-14",
        requester: "Sarah Wilson",
      },
      {
        id: "SRF-2025-002",
        title: "IT Support",
        serviceType: "it-support",
        description: "Network infrastructure upgrade",
        duration: "1 week",
        estimatedCost: "150000",
        urgency: "high",
        justification: "System performance improvement",
        status: "Completed",
        date: "2025-10-10",
        requester: "Tom Brown",
      },
    ];
  });
  
  // Persist MRF requests to localStorage
  React.useEffect(() => {
    localStorage.setItem("mrfRequests", JSON.stringify(mrfRequests));
  }, [mrfRequests]);
  
  // Persist SRF requests to localStorage  
  React.useEffect(() => {
    localStorage.setItem("srfRequests", JSON.stringify(srfRequests));
  }, [srfRequests]);

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([
    {
      id: "PO-2025-001",
      vendor: "ABC Suppliers Ltd",
      items: "Office Supplies Package",
      amount: "₦125,000",
      status: "Approved",
      date: "2025-10-10",
      deliveryDate: "2025-10-20",
    },
    {
      id: "PO-2025-002",
      vendor: "Tech Solutions Inc",
      items: "Computer Equipment",
      amount: "₦850,000",
      status: "Pending",
      date: "2025-10-12",
      deliveryDate: "2025-10-25",
    },
  ]);

  const [trips, setTrips] = useState<Trip[]>(() => {
    const stored = localStorage.getItem("trips");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse stored trips", e);
      }
    }
    return [
      {
        id: "TRP-001",
        route: "Lagos - Abuja",
        vehicle: "TRK-001",
        driver: "John Smith",
        status: "In Transit",
        departure: "2025-10-15 08:00",
        arrival: "2025-10-16 14:00",
        cargo: "Office Supplies, 2000kg",
      },
      {
        id: "TRP-002",
        route: "Abuja - Port Harcourt",
        vehicle: "TRK-002",
        driver: "Mary Johnson",
        status: "Scheduled",
        departure: "2025-10-16 06:00",
        arrival: "2025-10-17 10:00",
        cargo: "Raw Materials, 3500kg",
      },
    ];
  });

  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const stored = localStorage.getItem("vehicles");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse stored vehicles", e);
      }
    }
    return [
      {
        id: "TRK-001",
        name: "Truck Alpha",
        type: "Heavy Duty Truck",
        plate: "ABC-123-XY",
        status: "Active",
        driver: "John Smith",
        lastMaintenance: "2025-09-15",
      },
      {
        id: "TRK-002",
        name: "Truck Beta",
        type: "Medium Truck",
        plate: "DEF-456-ZW",
        status: "Active",
        driver: "Mary Johnson",
        lastMaintenance: "2025-09-20",
      },
    ];
  });

  // Persist trips to localStorage
  React.useEffect(() => {
    localStorage.setItem("trips", JSON.stringify(trips));
  }, [trips]);

  // Persist vehicles to localStorage
  React.useEffect(() => {
    localStorage.setItem("vehicles", JSON.stringify(vehicles));
  }, [vehicles]);

  const [vendors, setVendors] = useState<Vendor[]>([
    {
      id: "V001",
      name: "Steel Works Ltd",
      category: "Raw Materials",
      rating: 4.8,
      orders: 45,
      status: "Active",
      kyc: "Verified",
      email: "vendor@demo.com",
      phone: "+234-801-234-5678",
      address: "123 Industrial Road, Lagos",
      taxId: "TIN-123456789",
      contactPerson: "John Okafor",
      documents: [],
    },
    {
      id: "V002",
      name: "BuildMart Supplies",
      category: "Construction",
      rating: 4.5,
      orders: 32,
      status: "Active",
      kyc: "Verified",
      email: "buildmart@example.com",
      phone: "+234-802-345-6789",
      address: "45 Builder Street, Abuja",
      taxId: "TIN-234567890",
      contactPerson: "Mary Adeola",
      documents: [],
    },
    {
      id: "V003",
      name: "SafetyFirst Co",
      category: "Safety Equipment",
      rating: 4.9,
      orders: 28,
      status: "Active",
      kyc: "Verified",
      email: "safety@example.com",
      phone: "+234-803-456-7890",
      address: "78 Safety Avenue, Port Harcourt",
      taxId: "TIN-345678901",
      contactPerson: "Peter Chukwu",
      documents: [],
    },
    {
      id: "V004",
      name: "TechEquip Ltd",
      category: "Equipment",
      rating: 4.3,
      orders: 18,
      status: "Pending",
      kyc: "Under Review",
      email: "tech@example.com",
      phone: "+234-804-567-8901",
      address: "90 Tech Plaza, Ibadan",
      taxId: "TIN-456789012",
      contactPerson: "Ahmed Bello",
      documents: [],
    },
  ]);

  const [rfqs, setRfqs] = useState<RFQ[]>([
    {
      id: "RFQ-2025-001",
      mrfId: "MRF-2025-001",
      mrfTitle: "Office Supplies",
      description: "Stationery and office materials",
      quantity: "50",
      estimatedCost: "25000",
      deadline: "2025-10-20",
      status: "Open",
      createdDate: "2025-10-14",
      vendorIds: ["V001", "V002"],
    },
    {
      id: "RFQ-2025-002",
      mrfId: "MRF-2025-002",
      mrfTitle: "Raw Materials",
      description: "Production materials for Q4",
      quantity: "200",
      estimatedCost: "500000",
      deadline: "2025-10-25",
      status: "Open",
      createdDate: "2025-10-13",
      vendorIds: ["V001"],
    },
  ]);

  const [quotations, setQuotations] = useState<Quotation[]>([
    {
      id: "QUO-2025-001",
      rfqId: "RFQ-2025-001",
      vendorId: "V001",
      vendorName: "Steel Works Ltd",
      price: "23500",
      deliveryDate: "2025-10-18",
      notes: "Can deliver within 4 days",
      status: "Pending",
      submittedDate: "2025-10-15",
    },
  ]);

  const [vendorRegistrations, setVendorRegistrations] = useState<VendorRegistration[]>([
    {
      id: "VR-001",
      companyName: "New Vendor Co",
      category: "Office Supplies",
      email: "newvendor@example.com",
      phone: "+234-805-678-9012",
      address: "123 New Street, Lagos",
      taxId: "TIN-567890123",
      contactPerson: "Grace Nwosu",
      status: "Pending",
      submittedDate: "2025-10-14",
    },
  ]);

  const addMRF = (mrf: Omit<MRFRequest, "id" | "status" | "date" | "requester">) => {
    const userEmail = localStorage.getItem("userEmail") || "Current User";
    const userName = localStorage.getItem("userName") || "Current User";
    
    // All MRFs go to Executive first for review
    // Executive will then route based on value: >₦1M to Chairman, else to Procurement for PO
    const newMRF: MRFRequest = {
      ...mrf,
      id: `MRF-2025-${String(mrfRequests.length + 1).padStart(3, "0")}`,
      status: "Pending Executive Approval",
      date: new Date().toISOString().split("T")[0],
      requester: userName,
      currentStage: "executive",
      procurementManagerApprovalTime: new Date().toISOString(),
      approvalHistory: [],
    };
    setMrfRequests([newMRF, ...mrfRequests]);
  };

  const updateMRF = (id: string, updates: Partial<MRFRequest>) => {
    setMrfRequests(prev => prev.map((mrf) => (mrf.id === id ? { ...mrf, ...updates } : mrf)));
  };

  const approveMRF = (id: string, stage: string, approver: string, remarks: string) => {
    setMrfRequests(prev =>
      prev.map((mrf) => {
        if (mrf.id !== id) return mrf;

        const approvalAction: ApprovalAction = {
          stage,
          approver,
          action: "approved",
          remarks,
          timestamp: new Date().toISOString(),
        };

        const history = [...(mrf.approvalHistory || []), approvalAction];
        
        // For executive stage, just add to history - don't change status/stage
        // The updateMRF call handles the status/stage transition
        if (stage === "executive") {
          return {
            ...mrf,
            approvalHistory: history,
          };
        }
        
        let nextStage: MRFRequest["currentStage"];
        let status: string;

        if (stage === "procurement") {
          nextStage = "finance";
          status = "Procurement Approved";
        } else if (stage === "finance") {
          nextStage = "chairman";
          status = "Finance Approved";
        } else if (stage === "chairman") {
          nextStage = "approved";
          status = "Approved";
        } else {
          nextStage = mrf.currentStage;
          status = mrf.status;
        }

        return {
          ...mrf,
          currentStage: nextStage,
          status,
          approvalHistory: history,
        };
      })
    );
  };

  const rejectMRF = (id: string, stage: string, approver: string, remarks: string) => {
    setMrfRequests(
      mrfRequests.map((mrf) => {
        if (mrf.id !== id) return mrf;

        const rejectionAction: ApprovalAction = {
          stage,
          approver,
          action: "rejected",
          remarks,
          timestamp: new Date().toISOString(),
        };

        const history = [...(mrf.approvalHistory || []), rejectionAction];

        return {
          ...mrf,
          currentStage: "rejected",
          status: "Rejected",
          rejectionReason: remarks,
          approvalHistory: history,
        };
      })
    );
  };

  const addSRF = (srf: Omit<SRFRequest, "id" | "status" | "date" | "requester">) => {
    const userEmail = localStorage.getItem("userEmail") || "Current User";
    const userName = localStorage.getItem("userName") || "Current User";
    
    const newSRF: SRFRequest = {
      ...srf,
      id: `SRF-2025-${String(srfRequests.length + 1).padStart(3, "0")}`,
      status: "Pending",
      date: new Date().toISOString().split("T")[0],
      requester: userName,
    };
    setSrfRequests([newSRF, ...srfRequests]);
  };

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

  const addRFQ = (rfq: Omit<RFQ, "id" | "createdDate">) => {
    const newRFQ: RFQ = {
      ...rfq,
      id: `RFQ-2025-${String(rfqs.length + 1).padStart(3, "0")}`,
      createdDate: new Date().toISOString().split("T")[0],
    };
    setRfqs([newRFQ, ...rfqs]);
  };

  const updateRFQ = (id: string, updates: Partial<RFQ>) => {
    setRfqs(rfqs.map((rfq) => (rfq.id === id ? { ...rfq, ...updates } : rfq)));
  };

  const addQuotation = (quotation: Omit<Quotation, "id" | "submittedDate">) => {
    const newQuotation: Quotation = {
      ...quotation,
      id: `QUO-2025-${String(quotations.length + 1).padStart(3, "0")}`,
      submittedDate: new Date().toISOString().split("T")[0],
    };
    setQuotations([newQuotation, ...quotations]);
  };

  const updateQuotation = (id: string, updates: Partial<Quotation>) => {
    setQuotations(quotations.map((quo) => (quo.id === id ? { ...quo, ...updates } : quo)));
  };

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

  // Staff Drivers Management
  const [staffDrivers, setStaffDrivers] = useState<StaffDriver[]>(() => {
    const stored = localStorage.getItem("staffDrivers");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse stored staffDrivers", e);
      }
    }
    return [
      {
        id: "DRV-001",
        staffId: "EMP-001",
        name: "John Smith",
        email: "john.smith@emeraldcfze.com",
        department: "Operations",
        licenseNumber: "ABC123456",
        licenseExpiry: "2026-06-15",
        status: "available",
        designatedBy: "Logistics Manager",
        designatedDate: "2024-06-01",
        totalTrips: 45,
        rating: 4.8,
      },
      {
        id: "DRV-002",
        staffId: "EMP-002",
        name: "Mary Johnson",
        email: "mary.johnson@emeraldcfze.com",
        department: "Operations",
        licenseNumber: "DEF789012",
        licenseExpiry: "2025-12-20",
        status: "on-trip",
        designatedBy: "Logistics Manager",
        designatedDate: "2024-07-15",
        totalTrips: 38,
        rating: 4.9,
      },
      {
        id: "DRV-003",
        staffId: "EMP-003",
        name: "Mike Okonkwo",
        email: "mike.okonkwo@emeraldcfze.com",
        department: "Warehouse",
        licenseNumber: "GHI345678",
        licenseExpiry: "2026-03-10",
        status: "available",
        designatedBy: "Logistics Manager",
        designatedDate: "2024-09-01",
        totalTrips: 22,
        rating: 4.7,
      },
    ];
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
        mrfRequests,
        srfRequests,
        purchaseOrders,
        trips,
        vehicles,
        vendors,
        rfqs,
        quotations,
        vendorRegistrations,
        mrns,
        annualPlans,
        staffDrivers,
        addMRF,
        updateMRF,
        approveMRF,
        rejectMRF,
        addSRF,
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
        addRFQ,
        updateRFQ,
        addQuotation,
        updateQuotation,
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
