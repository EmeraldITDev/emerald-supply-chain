import { useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, Clock, CheckCircle, Plus, Search, Send, Download, AlertCircle } from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { toast } from "sonner";
import { exportToCSV, exportToExcel, exportToJSON } from "@/utils/exportData";

interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  department: string;
  project: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue" | "partial";
  paidAmount: number;
  balance: number;
  description: string;
  paymentTerms: string;
}

const mockInvoices: Invoice[] = [
  {
    id: "1",
    invoiceNumber: "INV-2024-001",
    customer: "Engineering Department",
    department: "Engineering",
    project: "Project Alpha",
    amount: 45000,
    issueDate: "2024-01-15",
    dueDate: "2024-02-15",
    status: "overdue",
    paidAmount: 0,
    balance: 45000,
    description: "Equipment rental and services",
    paymentTerms: "Net 30"
  },
  {
    id: "2",
    invoiceNumber: "INV-2024-002",
    customer: "Operations Department",
    department: "Operations",
    project: "Project Beta",
    amount: 28500,
    issueDate: "2024-01-20",
    dueDate: "2024-02-20",
    status: "pending",
    paidAmount: 0,
    balance: 28500,
    description: "Monthly facility management",
    paymentTerms: "Net 30"
  },
  {
    id: "3",
    invoiceNumber: "INV-2024-003",
    customer: "IT Department",
    department: "IT",
    project: "Infrastructure Upgrade",
    amount: 67800,
    issueDate: "2024-01-10",
    dueDate: "2024-02-10",
    status: "partial",
    paidAmount: 30000,
    balance: 37800,
    description: "Hardware and software licenses",
    paymentTerms: "Net 30"
  },
  {
    id: "4",
    invoiceNumber: "INV-2024-004",
    customer: "Marketing Department",
    department: "Marketing",
    project: "Campaign Q1",
    amount: 15200,
    issueDate: "2024-01-25",
    dueDate: "2024-02-25",
    status: "paid",
    paidAmount: 15200,
    balance: 0,
    description: "Marketing services and materials",
    paymentTerms: "Net 30"
  },
  {
    id: "5",
    invoiceNumber: "INV-2024-005",
    customer: "Finance Department",
    department: "Finance",
    project: "Audit Support",
    amount: 12300,
    issueDate: "2024-01-28",
    dueDate: "2024-02-28",
    status: "pending",
    paidAmount: 0,
    balance: 12300,
    description: "Consulting and audit services",
    paymentTerms: "Net 30"
  }
];

export default function AccountsReceivable() {
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Calculate summary metrics
  const metrics = useMemo(() => {
    const totalReceivables = invoices.reduce((sum, inv) => sum + inv.balance, 0);
    const overdueAmount = invoices
      .filter(inv => inv.status === "overdue")
      .reduce((sum, inv) => sum + inv.balance, 0);
    const collectedThisMonth = invoices
      .filter(inv => inv.status === "paid")
      .reduce((sum, inv) => sum + inv.paidAmount, 0);
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.amount, 0);
    const collectionRate = totalInvoiced > 0 ? ((collectedThisMonth / totalInvoiced) * 100).toFixed(1) : "0.0";

    return {
      totalReceivables,
      overdueAmount,
      overdueCount: invoices.filter(inv => inv.status === "overdue").length,
      collectedThisMonth,
      collectionRate
    };
  }, [invoices]);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const matchesSearch = 
        invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.project.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
      const matchesDepartment = departmentFilter === "all" || invoice.department === departmentFilter;
      
      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [invoices, searchQuery, statusFilter, departmentFilter]);

  // Get aging summary
  const agingSummary = useMemo(() => {
    const current = invoices.filter(inv => {
      const daysOverdue = Math.floor((new Date().getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      return daysOverdue <= 0 && inv.status !== "paid";
    }).reduce((sum, inv) => sum + inv.balance, 0);

    const days30 = invoices.filter(inv => {
      const daysOverdue = Math.floor((new Date().getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      return daysOverdue > 0 && daysOverdue <= 30;
    }).reduce((sum, inv) => sum + inv.balance, 0);

    const days60 = invoices.filter(inv => {
      const daysOverdue = Math.floor((new Date().getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      return daysOverdue > 30 && daysOverdue <= 60;
    }).reduce((sum, inv) => sum + inv.balance, 0);

    const days90Plus = invoices.filter(inv => {
      const daysOverdue = Math.floor((new Date().getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      return daysOverdue > 60;
    }).reduce((sum, inv) => sum + inv.balance, 0);

    return { current, days30, days60, days90Plus };
  }, [invoices]);

  const handleCreateInvoice = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newInvoice: Invoice = {
      id: String(invoices.length + 1),
      invoiceNumber: `INV-2024-${String(invoices.length + 1).padStart(3, '0')}`,
      customer: formData.get("customer") as string,
      department: formData.get("department") as string,
      project: formData.get("project") as string,
      amount: Number(formData.get("amount")),
      issueDate: formData.get("issueDate") as string,
      dueDate: formData.get("dueDate") as string,
      status: "pending",
      paidAmount: 0,
      balance: Number(formData.get("amount")),
      description: formData.get("description") as string,
      paymentTerms: formData.get("paymentTerms") as string,
    };

    setInvoices([newInvoice, ...invoices]);
    setNewInvoiceOpen(false);
    toast.success(`Invoice ${newInvoice.invoiceNumber} created successfully`);
  };

  const handleRecordPayment = (invoice: Invoice) => {
    const paymentAmount = prompt(`Enter payment amount for ${invoice.invoiceNumber} (Balance: $${invoice.balance.toLocaleString()}):`);
    
    if (paymentAmount) {
      const amount = Number(paymentAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error("Invalid payment amount");
        return;
      }

      if (amount > invoice.balance) {
        toast.error("Payment amount cannot exceed balance");
        return;
      }

      setInvoices(invoices.map(inv => {
        if (inv.id === invoice.id) {
          const newPaidAmount = inv.paidAmount + amount;
          const newBalance = inv.amount - newPaidAmount;
          return {
            ...inv,
            paidAmount: newPaidAmount,
            balance: newBalance,
            status: newBalance === 0 ? "paid" : newBalance < inv.amount ? "partial" : inv.status
          };
        }
        return inv;
      }));

      toast.success(`Payment of $${amount.toLocaleString()} recorded successfully`);
    }
  };

  const handleSendReminder = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setReminderDialogOpen(true);
  };

  const confirmSendReminder = () => {
    if (selectedInvoice) {
      toast.success(`Payment reminder sent for ${selectedInvoice.invoiceNumber}`);
      setReminderDialogOpen(false);
      setSelectedInvoice(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-success">Paid</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>;
      case "partial":
        return <Badge className="bg-info">Partial</Badge>;
      default:
        return null;
    }
  };

  const handleExport = (format: 'csv' | 'excel' | 'json') => {
    const exportData = filteredInvoices.map(inv => ({
      'Invoice Number': inv.invoiceNumber,
      'Customer': inv.customer,
      'Department': inv.department,
      'Project': inv.project,
      'Amount': inv.amount,
      'Issue Date': inv.issueDate,
      'Due Date': inv.dueDate,
      'Status': inv.status,
      'Paid Amount': inv.paidAmount,
      'Balance': inv.balance,
      'Description': inv.description,
    }));

    switch (format) {
      case 'csv':
        exportToCSV(exportData, 'accounts-receivable');
        break;
      case 'excel':
        exportToExcel(exportData, 'accounts-receivable');
        break;
      case 'json':
        exportToJSON(exportData, 'accounts-receivable');
        break;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Accounts Receivable</h1>
              <p className="text-muted-foreground">Track billing and incoming payments</p>
            </div>
          </div>
          <Dialog open={newInvoiceOpen} onOpenChange={setNewInvoiceOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-card">
              <DialogHeader>
                <DialogTitle>Create New Invoice</DialogTitle>
                <DialogDescription>
                  Log a new internal or inter-departmental receivable
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateInvoice} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer">Customer/Department *</Label>
                    <Input id="customer" name="customer" required placeholder="e.g., Engineering Department" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Department *</Label>
                    <Select name="department" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="Engineering">Engineering</SelectItem>
                        <SelectItem value="Operations">Operations</SelectItem>
                        <SelectItem value="IT">IT</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="project">Project/Reference *</Label>
                    <Input id="project" name="project" required placeholder="e.g., Project Alpha" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount ($) *</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" required placeholder="0.00" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="issueDate">Issue Date *</Label>
                    <Input id="issueDate" name="issueDate" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date *</Label>
                    <Input id="dueDate" name="dueDate" type="date" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentTerms">Payment Terms *</Label>
                  <Select name="paymentTerms" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 60">Net 60</SelectItem>
                      <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Input id="description" name="description" required placeholder="Brief description of services/goods" />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setNewInvoiceOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Invoice</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Receivables</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${metrics.totalReceivables.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Outstanding balances</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <Clock className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${metrics.overdueAmount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{metrics.overdueCount} invoices past due</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collected This Month</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${metrics.collectedThisMonth.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{invoices.filter(i => i.status === "paid").length} payments received</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.collectionRate}%</div>
              <p className="text-xs text-muted-foreground">+2.4% from last month</p>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Alert Banner */}
        {metrics.overdueAmount > 0 && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="flex items-center gap-3 pt-6">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <p className="font-medium text-destructive">
                  {metrics.overdueCount} invoice{metrics.overdueCount !== 1 ? 's' : ''} overdue
                </p>
                <p className="text-sm text-muted-foreground">
                  Total overdue amount: ${metrics.overdueAmount.toLocaleString()}
                </p>
              </div>
              <Button variant="outline" size="sm">View Overdue</Button>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="invoices" className="space-y-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="aging">Aging Report</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by invoice number, customer, or project..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by department" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      <SelectItem value="all">All Departments</SelectItem>
                      <SelectItem value="Engineering">Engineering</SelectItem>
                      <SelectItem value="Operations">Operations</SelectItem>
                      <SelectItem value="IT">IT</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                    </SelectContent>
                  </Select>
                  <ExportMenu onExport={handleExport} />
                </div>
              </CardContent>
            </Card>

            {/* Invoices Table */}
            <Card>
              <CardHeader>
                <CardTitle>Invoice List</CardTitle>
                <CardDescription>{filteredInvoices.length} invoice(s) found</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            No invoices found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredInvoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{invoice.customer}</p>
                                <p className="text-xs text-muted-foreground">{invoice.department}</p>
                              </div>
                            </TableCell>
                            <TableCell>{invoice.project}</TableCell>
                            <TableCell>${invoice.amount.toLocaleString()}</TableCell>
                            <TableCell className="font-medium">
                              ${invoice.balance.toLocaleString()}
                            </TableCell>
                            <TableCell>{invoice.dueDate}</TableCell>
                            <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                {invoice.status !== "paid" && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRecordPayment(invoice)}
                                    >
                                      Record Payment
                                    </Button>
                                    {invoice.status === "overdue" && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleSendReminder(invoice)}
                                      >
                                        <Send className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </>
                                )}
                                <Button variant="ghost" size="sm">
                                  <Download className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="aging" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Accounts Receivable Aging</CardTitle>
                <CardDescription>Outstanding balances by age category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Current</CardTitle>
                      <p className="text-xs text-muted-foreground">0-30 days</p>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${agingSummary.current.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">31-60 Days</CardTitle>
                      <p className="text-xs text-muted-foreground">Past due</p>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-warning">${agingSummary.days30.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">61-90 Days</CardTitle>
                      <p className="text-xs text-muted-foreground">Seriously overdue</p>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-destructive">${agingSummary.days60.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">90+ Days</CardTitle>
                      <p className="text-xs text-muted-foreground">Critical</p>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-destructive">${agingSummary.days90Plus.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Reminder Dialog */}
        <AlertDialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
          <AlertDialogContent className="bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle>Send Payment Reminder</AlertDialogTitle>
              <AlertDialogDescription>
                Send a payment reminder for invoice {selectedInvoice?.invoiceNumber} to {selectedInvoice?.customer}?
                <br />
                <br />
                Outstanding balance: <strong>${selectedInvoice?.balance.toLocaleString()}</strong>
                <br />
                Due date: <strong>{selectedInvoice?.dueDate}</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmSendReminder}>Send Reminder</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
