import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, Download, Package, Trash2 } from "lucide-react";
import { warehouseApi } from "@/services/warehouseApi";
import { DMC_LOCATIONS, DMC_UOM_OPTIONS } from "@/types/warehouse";
import type { MaterialConsumption, CreateMaterialConsumptionData } from "@/types/warehouse";

export const DailyMaterialsConsumption = () => {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterFSE, setFilterFSE] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const records = useMemo(() => {
    return warehouseApi.getMaterialsConsumption({
      month: filterMonth || undefined,
      location: filterLocation || undefined,
      fse: filterFSE || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterMonth, filterLocation, filterFSE, refreshKey]);

  const [form, setForm] = useState<Partial<CreateMaterialConsumptionData>>({
    ownedBy: "OANDO",
    maintenanceType: "Corrective",
  });

  const updateForm = (field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCreate = () => {
    if (!form.dateIssued || !form.unitTag || !form.location || !form.itemCode || !form.itemDescription || !form.qtyIssued || !form.uom || !form.fse) {
      toast({ title: "Validation Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    warehouseApi.createMaterialConsumption(form as CreateMaterialConsumptionData);
    toast({ title: "Record Created", description: "Materials consumption record saved" });
    setForm({ ownedBy: "OANDO", maintenanceType: "Corrective" });
    setCreateOpen(false);
    setRefreshKey(k => k + 1);
  };

  const handleDelete = (id: string) => {
    warehouseApi.deleteMaterialConsumption(id);
    toast({ title: "Record Deleted" });
    setRefreshKey(k => k + 1);
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const XLSX = await import("xlsx");
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      if (rows.length === 0) {
        toast({ title: "Empty File", description: "No data found in the uploaded file", variant: "destructive" });
        return;
      }

      const items: CreateMaterialConsumptionData[] = rows.map(row => ({
        dateIssued: String(row["Date Issued"] || row["dateIssued"] || new Date().toISOString().split("T")[0]),
        unitTag: String(row["Unit Tag"] || row["unitTag"] || ""),
        location: String(row["Location"] || row["location"] || ""),
        equipmentModel: String(row["Equipment Model"] || row["equipmentModel"] || ""),
        maintenanceType: (row["Maintenance Type"] || row["maintenanceType"] || "Corrective") as any,
        ownedBy: String(row["Owned By"] || row["ownedBy"] || "OANDO"),
        workOrder: row["Work Order"] || row["workOrder"] || undefined,
        peNumber: row["PE No."] || row["peNumber"] || undefined,
        itemCode: String(row["Item Code"] || row["itemCode"] || ""),
        itemDescription: String(row["Item Description"] || row["itemDescription"] || ""),
        qtyIssued: Number(row["Qty Issued"] || row["qtyIssued"] || 0),
        uom: String(row["UOM"] || row["uom"] || "PCS"),
        fse: String(row["FSE"] || row["fse"] || ""),
        remark: row["Remark"] || row["remark"] || undefined,
      }));

      const valid = items.filter(i => i.itemCode && i.itemDescription && i.qtyIssued > 0);
      if (valid.length === 0) {
        toast({ title: "No Valid Rows", description: "No valid data rows found", variant: "destructive" });
        return;
      }

      warehouseApi.bulkCreateMaterialConsumption(valid);
      toast({ title: "Upload Successful", description: `${valid.length} records imported` });
      setRefreshKey(k => k + 1);
    } catch (err) {
      toast({ title: "Upload Failed", description: "Could not parse the file. Please use the template format.", variant: "destructive" });
    }

    e.target.value = "";
  };

  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import("xlsx");
      const headers = [
        "Date Issued", "Unit Tag", "Location", "Equipment Model",
        "Maintenance Type", "Owned By", "Work Order", "PE No.",
        "Item Code", "Item Description", "Qty Issued", "UOM", "FSE", "Remark"
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, [
        "2026-03-01", "UNT-001", "OB/OB", "CAT 3512", "Corrective", "OANDO", "WO-001", "PE-001",
        "ITM-001", "Oil Filter", "2", "PCS", "John Doe", ""
      ]]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Materials Consumption");
      XLSX.writeFile(wb, "materials_consumption_template.xlsx");
    } catch {
      toast({ title: "Error", description: "Could not generate template", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Daily Materials Consumption</h3>
          <p className="text-sm text-muted-foreground">Track materials issued from warehouse for maintenance/operations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
            <Download className="h-4 w-4" />
            Template
          </Button>
          <label>
            <Button variant="outline" asChild className="gap-2 cursor-pointer">
              <span>
                <Upload className="h-4 w-4" />
                Bulk Upload
              </span>
            </Button>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBulkUpload} />
          </label>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Record
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Filter by Month</Label>
              <Input
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                placeholder="YYYY-MM"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Filter by Location</Label>
              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {DMC_LOCATIONS.map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Filter by FSE</Label>
              <Input
                value={filterFSE}
                onChange={(e) => setFilterFSE(e.target.value)}
                placeholder="Search FSE name..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consumption Records</CardTitle>
          <CardDescription>{records.length} record(s) found</CardDescription>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No consumption records found</p>
              <p className="text-sm mt-1">Create a new record or upload an Excel file</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1200px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Unit Tag</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Maint. Type</TableHead>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead>FSE</TableHead>
                    <TableHead>Remark</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{r.dateIssued}</TableCell>
                      <TableCell>{r.unitTag}</TableCell>
                      <TableCell>{r.location}</TableCell>
                      <TableCell>{r.equipmentModel}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.maintenanceType}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.itemCode}</TableCell>
                      <TableCell>{r.itemDescription}</TableCell>
                      <TableCell>{r.qtyIssued}</TableCell>
                      <TableCell>{r.uom}</TableCell>
                      <TableCell>{r.fse}</TableCell>
                      <TableCell>
                        {r.remark && (
                          <Badge variant={r.remark.toLowerCase().includes("returned") ? "secondary" : "outline"}>
                            {r.remark}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Materials Consumption Record</DialogTitle>
            <DialogDescription>Record materials issued from warehouse</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date Issued *</Label>
              <Input type="date" value={form.dateIssued || ""} onChange={(e) => updateForm("dateIssued", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Unit Tag *</Label>
              <Input placeholder="e.g. UNT-001" value={form.unitTag || ""} onChange={(e) => updateForm("unitTag", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Location *</Label>
              <Select value={form.location || ""} onValueChange={(v) => updateForm("location", v)}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {DMC_LOCATIONS.map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Equipment Model</Label>
              <Input placeholder="e.g. CAT 3512" value={form.equipmentModel || ""} onChange={(e) => updateForm("equipmentModel", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Maintenance Type *</Label>
              <Select value={form.maintenanceType || "Corrective"} onValueChange={(v) => updateForm("maintenanceType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Corrective">Corrective</SelectItem>
                  <SelectItem value="Preventive">Preventive</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Owned By</Label>
              <Input value={form.ownedBy || "OANDO"} onChange={(e) => updateForm("ownedBy", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Work Order</Label>
              <Input placeholder="WO-XXX" value={form.workOrder || ""} onChange={(e) => updateForm("workOrder", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>PE No.</Label>
              <Input placeholder="PE-XXX" value={form.peNumber || ""} onChange={(e) => updateForm("peNumber", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Item Code *</Label>
              <Input placeholder="e.g. ITM-001" value={form.itemCode || ""} onChange={(e) => updateForm("itemCode", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Item Description *</Label>
              <Input placeholder="e.g. Oil Filter" value={form.itemDescription || ""} onChange={(e) => updateForm("itemDescription", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Qty Issued *</Label>
              <Input type="number" min={1} value={form.qtyIssued || ""} onChange={(e) => updateForm("qtyIssued", parseInt(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>UOM *</Label>
              <Select value={form.uom || ""} onValueChange={(v) => updateForm("uom", v)}>
                <SelectTrigger><SelectValue placeholder="Select UOM" /></SelectTrigger>
                <SelectContent>
                  {DMC_UOM_OPTIONS.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>FSE (Field Service Engineer) *</Label>
              <Input placeholder="Engineer name" value={form.fse || ""} onChange={(e) => updateForm("fse", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Remark</Label>
              <Input placeholder="e.g. Returned" value={form.remark || ""} onChange={(e) => updateForm("remark", e.target.value)} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Save Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
