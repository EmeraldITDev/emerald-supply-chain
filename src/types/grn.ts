// GRN (Goods Received Note) Types

export interface GRNItem {
  id: string;
  name: string;
  description?: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  totalAmount: number;
  condition: 'Good' | 'Damaged' | 'Partial';
  remarks?: string;
}

export interface GRN {
  id: string;
  grnNumber: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  receivedDate: string;
  receivedBy: string;
  inspectedBy?: string;
  inspectionDate?: string;
  items: GRNItem[];
  totalAmount: number;
  status: 'Pending Inspection' | 'Inspected' | 'Approved' | 'With Finance' | 'Payment Processing' | 'Completed' | 'Rejected';
  warehouseLocation?: string;
  deliveryNoteNumber?: string;
  invoiceNumber?: string;
  invoiceAmount?: number;
  financeReceivedDate?: string;
  financeProcessedBy?: string;
  paymentStatus?: 'Pending' | 'Approved' | 'Paid';
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGRNData {
  poNumber: string;
  vendorId: string;
  vendorName: string;
  items: Omit<GRNItem, 'id'>[];
  warehouseLocation?: string;
  deliveryNoteNumber?: string;
  invoiceNumber?: string;
  invoiceAmount?: number;
  remarks?: string;
}
