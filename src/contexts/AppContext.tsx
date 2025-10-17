import React, { createContext, useContext, useState, ReactNode } from "react";

// Types
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

export interface Vendor {
  id: string;
  name: string;
  category: string;
  rating: number;
  orders: number;
  status: string;
  kyc: string;
  documents: VendorDocument[];
}

interface AppContextType {
  mrfRequests: MRFRequest[];
  srfRequests: SRFRequest[];
  purchaseOrders: PurchaseOrder[];
  trips: Trip[];
  vehicles: Vehicle[];
  vendors: Vendor[];
  addMRF: (mrf: Omit<MRFRequest, "id" | "status" | "date" | "requester">) => void;
  addSRF: (srf: Omit<SRFRequest, "id" | "status" | "date" | "requester">) => void;
  addPO: (po: Omit<PurchaseOrder, "id">) => void;
  updateTrip: (id: string, updates: Partial<Trip>) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  addVendor: (vendor: Omit<Vendor, "id" | "documents">) => void;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  addVendorDocument: (vendorId: string, document: Omit<VendorDocument, "id" | "uploadDate">) => void;
  deleteVendorDocument: (vendorId: string, documentId: string) => void;
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
      status: "Pending",
      date: "2025-10-14",
      requester: "John Doe",
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
      status: "Approved",
      date: "2025-10-13",
      requester: "Jane Smith",
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
      documents: [],
    },
  ]);

  const addMRF = (mrf: Omit<MRFRequest, "id" | "status" | "date" | "requester">) => {
    const newMRF: MRFRequest = {
      ...mrf,
      id: `MRF-2025-${String(mrfRequests.length + 1).padStart(3, "0")}`,
      status: "Pending",
      date: new Date().toISOString().split("T")[0],
      requester: "Current User",
    };
    setMrfRequests([newMRF, ...mrfRequests]);
  };

  const addSRF = (srf: Omit<SRFRequest, "id" | "status" | "date" | "requester">) => {
    const newSRF: SRFRequest = {
      ...srf,
      id: `SRF-2025-${String(srfRequests.length + 1).padStart(3, "0")}`,
      status: "Pending",
      date: new Date().toISOString().split("T")[0],
      requester: "Current User",
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

  return (
    <AppContext.Provider
      value={{
        mrfRequests,
        srfRequests,
        purchaseOrders,
        trips,
        vehicles,
        vendors,
        addMRF,
        addSRF,
        addPO,
        updateTrip,
        updateVehicle,
        addVendor,
        updateVendor,
        addVendorDocument,
        deleteVendorDocument,
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
