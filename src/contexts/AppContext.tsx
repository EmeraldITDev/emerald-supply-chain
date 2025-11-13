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
  // Approval workflow fields
  currentStage?: "submitted" | "procurement" | "finance" | "chairman" | "approved" | "rejected";
  procurementManagerApprovalTime?: string;
  approvalHistory?: ApprovalAction[];
  rejectionReason?: string;
  isResubmission?: boolean;
  // Document support
  documents?: string[]; // Array of base64 encoded documents
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

export interface Trip {
  id: string;
  route: string;
  vehicle: string;
  driver: string;
  status: string;
  departure: string;
  arrival: string;
  cargo: string;
}

export interface Vehicle {
  id: string;
  name: string;
  type: string;
  plate: string;
  status: string;
  driver: string;
  lastMaintenance: string;
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
  reviewNotes?: string;
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
  addMRF: (mrf: Omit<MRFRequest, "id" | "status" | "date" | "requester">) => void;
  updateMRF: (id: string, updates: Partial<MRFRequest>) => void;
  approveMRF: (id: string, stage: string, approver: string, remarks: string) => void;
  rejectMRF: (id: string, stage: string, approver: string, remarks: string) => void;
  addSRF: (srf: Omit<SRFRequest, "id" | "status" | "date" | "requester">) => void;
  addPO: (po: Omit<PurchaseOrder, "id">) => void;
  updateTrip: (id: string, updates: Partial<Trip>) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
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
  addMRN: (mrn: Omit<MRN, "id" | "controlNumber" | "requesterId" | "requesterName" | "submittedDate" | "status">) => void;
  updateMRN: (id: string, updates: Partial<MRN>) => void;
  convertMRNToMRF: (mrnId: string, reviewerName: string) => void;
  addAnnualPlan: (plan: Omit<AnnualProcurementPlan, "id" | "submittedBy" | "submittedDate" | "status" | "totalEstimatedBudget">) => void;
  updateAnnualPlan: (id: string, updates: Partial<AnnualProcurementPlan>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [mrfRequests, setMrfRequests] = useState<MRFRequest[]>([
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
  ]);

  const [srfRequests, setSrfRequests] = useState<SRFRequest[]>([
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
  ]);

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

  const [trips, setTrips] = useState<Trip[]>([
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
  ]);

  const [vehicles, setVehicles] = useState<Vehicle[]>([
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
  ]);

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
    
    const newMRF: MRFRequest = {
      ...mrf,
      id: `MRF-2025-${String(mrfRequests.length + 1).padStart(3, "0")}`,
      status: "Submitted",
      date: new Date().toISOString().split("T")[0],
      requester: userName,
      currentStage: "procurement",
      procurementManagerApprovalTime: new Date().toISOString(),
      approvalHistory: [],
    };
    setMrfRequests([newMRF, ...mrfRequests]);
  };

  const updateMRF = (id: string, updates: Partial<MRFRequest>) => {
    setMrfRequests(mrfRequests.map((mrf) => (mrf.id === id ? { ...mrf, ...updates } : mrf)));
  };

  const approveMRF = (id: string, stage: string, approver: string, remarks: string) => {
    setMrfRequests(
      mrfRequests.map((mrf) => {
        if (mrf.id !== id) return mrf;

        const approvalAction: ApprovalAction = {
          stage,
          approver,
          action: "approved",
          remarks,
          timestamp: new Date().toISOString(),
        };

        const history = [...(mrf.approvalHistory || []), approvalAction];
        
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

  const updateVehicle = (id: string, updates: Partial<Vehicle>) => {
    setVehicles(vehicles.map((vehicle) => (vehicle.id === id ? { ...vehicle, ...updates } : vehicle)));
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

    // Create MRF from MRN
    const newMRF: MRFRequest = {
      id: `MRF-${new Date().getFullYear()}-${String(mrfRequests.length + 1).padStart(3, "0")}`,
      title: mrn.title,
      category: mrn.category,
      description: `Converted from ${mrn.controlNumber}: ${mrn.items.map(i => i.name).join(", ")}`,
      quantity: mrn.items.length.toString(),
      estimatedCost: totalCost.toString(),
      urgency: mrn.urgency.toLowerCase() as "high" | "medium" | "low",
      justification: mrn.justification,
      status: "Submitted",
      date: new Date().toISOString().split("T")[0],
      requester: mrn.requesterName,
      currentStage: "procurement",
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
        addMRF,
        updateMRF,
        approveMRF,
        rejectMRF,
        addSRF,
        addPO,
        updateTrip,
        updateVehicle,
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
        addMRN,
        updateMRN,
        convertMRNToMRF,
        addAnnualPlan,
        updateAnnualPlan,
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
