import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, Download, Truck, MapPin, Package, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { tripsApi, journeysApi, materialsApi, fleetApi } from "@/services/logisticsApi";

type ReportCategory = "trips" | "journeys" | "fleet" | "materials" | "summary";

interface ReportSection {
  title: string;
  data: Record<string, string | number>[];
  columns: { key: string; label: string }[];
}

interface GeneratedReport {
  title: string;
  generatedAt: string;
  category: ReportCategory;
  periodStart: string;
  periodEnd: string;
  sections: ReportSection[];
  summary: Record<string, string | number>;
}

interface LogisticsReportGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categoryIcons: Record<ReportCategory, React.ReactNode> = {
  trips: <Truck className="h-4 w-4" />,
  journeys: <MapPin className="h-4 w-4" />,
  fleet: <Truck className="h-4 w-4" />,
  materials: <Package className="h-4 w-4" />,
  summary: <BarChart3 className="h-4 w-4" />,
};

const categoryLabels: Record<ReportCategory, string> = {
  trips: "Trips Report",
  journeys: "Journeys Report",
  fleet: "Fleet Report",
  materials: "Materials Report",
  summary: "Holistic Summary Report",
};

export const LogisticsReportGenerator = ({ open, onOpenChange }: LogisticsReportGeneratorProps) => {
  const { toast } = useToast();
  const [category, setCategory] = useState<ReportCategory>("summary");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<GeneratedReport | null>(null);

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const sections: ReportSection[] = [];
      const summaryData: Record<string, string | number> = {};

      const includeTrips = category === "trips" || category === "summary";
      const includeFleet = category === "fleet" || category === "summary";
      const includeMaterials = category === "materials" || category === "summary";

      // Fetch data in parallel
      const [tripsRes, fleetRes, materialsRes] = await Promise.all([
        includeTrips ? tripsApi.getAll() : Promise.resolve({ success: false, data: [] }),
        includeFleet ? fleetApi.getAll() : Promise.resolve({ success: false, data: [] }),
        includeMaterials ? materialsApi.getAll() : Promise.resolve({ success: false, data: [] }),
      ]);

      // Process trips
      if (includeTrips) {
        const trips = Array.isArray(tripsRes.data) ? tripsRes.data : [];
        const normalizedTrips = trips.map((t: any) => ({
          trip_number: t.trip_code || t.tripNumber || t.trip_number || `TRIP-${t.id}`,
          type: t.trip_type || t.type || "N/A",
          origin: t.origin || "N/A",
          destination: t.destination || "N/A",
          status: t.status || "N/A",
          priority: t.priority || "normal",
          scheduled: t.scheduled_departure_at || t.scheduledDepartureAt || "N/A",
          vendor: t.vendor?.name || t.vendorName || "Unassigned",
        }));

        sections.push({
          title: "Trips Overview",
          data: normalizedTrips,
          columns: [
            { key: "trip_number", label: "Trip #" },
            { key: "type", label: "Type" },
            { key: "origin", label: "Origin" },
            { key: "destination", label: "Destination" },
            { key: "status", label: "Status" },
            { key: "vendor", label: "Vendor" },
          ],
        });

        summaryData["Total Trips"] = normalizedTrips.length;
        summaryData["Completed Trips"] = normalizedTrips.filter((t: any) => t.status === "completed").length;
        summaryData["Scheduled Trips"] = normalizedTrips.filter((t: any) => t.status === "scheduled").length;
        summaryData["Cancelled Trips"] = normalizedTrips.filter((t: any) => t.status === "cancelled").length;
        summaryData["In Progress"] = normalizedTrips.filter((t: any) => t.status === "in_progress").length;
      }

      // Process fleet
      if (includeFleet) {
        const vehicles = Array.isArray(fleetRes.data) ? fleetRes.data : [];
        const normalizedVehicles = vehicles.map((v: any) => ({
          plate: v.plate || v.licensePlate || "N/A",
          name: v.name || `${v.make || ""} ${v.model || ""}`.trim() || "N/A",
          type: v.type || "N/A",
          status: v.status || "N/A",
          ownership: v.ownership || "N/A",
          capacity: v.passenger_capacity || v.passengerCapacity || "N/A",
        }));

        sections.push({
          title: "Fleet Overview",
          data: normalizedVehicles,
          columns: [
            { key: "plate", label: "Plate" },
            { key: "name", label: "Vehicle" },
            { key: "type", label: "Type" },
            { key: "status", label: "Status" },
            { key: "ownership", label: "Ownership" },
            { key: "capacity", label: "Capacity" },
          ],
        });

        summaryData["Total Vehicles"] = normalizedVehicles.length;
        summaryData["Active Vehicles"] = normalizedVehicles.filter((v: any) => v.status === "active").length;
      }

      // Process materials
      if (includeMaterials) {
        const materials = Array.isArray(materialsRes.data) ? materialsRes.data : [];
        const normalizedMaterials = materials.map((m: any) => ({
          material_number: m.material_number || m.materialNumber || `MAT-${m.id}`,
          name: m.name || "N/A",
          category: m.category || "N/A",
          quantity: m.quantity ?? 0,
          unit: m.unit || "units",
          status: m.status || "N/A",
          condition: m.condition || "N/A",
          location: m.current_location || m.currentLocation || "N/A",
        }));

        sections.push({
          title: "Materials Inventory",
          data: normalizedMaterials,
          columns: [
            { key: "material_number", label: "Material #" },
            { key: "name", label: "Name" },
            { key: "category", label: "Category" },
            { key: "quantity", label: "Qty" },
            { key: "status", label: "Status" },
            { key: "location", label: "Location" },
          ],
        });

        summaryData["Total Materials"] = normalizedMaterials.length;
        summaryData["In Transit"] = normalizedMaterials.filter((m: any) => m.status === "in_transit").length;
        summaryData["Damaged"] = normalizedMaterials.filter((m: any) => m.condition === "damaged" || m.status === "damaged").length;
      }

      // Journeys section (for journey/summary)
      if (category === "journeys" || category === "summary") {
        // Journeys are trip-level, we summarize from trips data
        const trips = Array.isArray(tripsRes.data) ? tripsRes.data : [];
        summaryData["Trips with Journeys"] = trips.filter((t: any) => t.status === "in_progress" || t.status === "completed").length;
      }

      const generated: GeneratedReport = {
        title: categoryLabels[category],
        generatedAt: new Date().toISOString(),
        category,
        periodStart: periodStart || "All time",
        periodEnd: periodEnd || "Present",
        sections,
        summary: summaryData,
      };

      setReport(generated);
      toast({ title: "Report Generated", description: `${categoryLabels[category]} created successfully` });
    } catch (error) {
      toast({ title: "Generation Failed", description: "Failed to fetch data for report", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadReportCSV = () => {
    if (!report) return;

    let csv = `${report.title}\nGenerated: ${new Date(report.generatedAt).toLocaleString()}\nPeriod: ${report.periodStart} - ${report.periodEnd}\n\n`;

    // Summary
    csv += "=== SUMMARY ===\n";
    Object.entries(report.summary).forEach(([key, value]) => {
      csv += `${key},${value}\n`;
    });
    csv += "\n";

    // Sections
    report.sections.forEach((section) => {
      csv += `=== ${section.title.toUpperCase()} ===\n`;
      csv += section.columns.map((c) => c.label).join(",") + "\n";
      section.data.forEach((row) => {
        csv += section.columns.map((c) => `"${String(row[c.key] || "").replace(/"/g, '""')}"`).join(",") + "\n";
      });
      csv += "\n";
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.category}_report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) setReport(null); onOpenChange(val); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Logistics Report</DialogTitle>
          <DialogDescription>Create comprehensive reports from system data</DialogDescription>
        </DialogHeader>

        {!report ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Report Category *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ReportCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">
                    <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Holistic Summary</span>
                  </SelectItem>
                  <SelectItem value="trips">
                    <span className="flex items-center gap-2"><Truck className="h-4 w-4" /> Trips Report</span>
                  </SelectItem>
                  <SelectItem value="journeys">
                    <span className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Journeys Report</span>
                  </SelectItem>
                  <SelectItem value="fleet">
                    <span className="flex items-center gap-2"><Truck className="h-4 w-4" /> Fleet Report</span>
                  </SelectItem>
                  <SelectItem value="materials">
                    <span className="flex items-center gap-2"><Package className="h-4 w-4" /> Materials Report</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Period Start (optional)</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Period End (optional)</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Report Header */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <h3 className="font-semibold flex items-center gap-2">
                  {categoryIcons[report.category]}
                  {report.title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Generated: {new Date(report.generatedAt).toLocaleString()} • Period: {report.periodStart} — {report.periodEnd}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadReportCSV}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(report.summary).map(([key, value]) => (
                <Card key={key}>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">{key}</p>
                    <p className="text-lg font-bold">{value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Separator />

            {/* Data Sections */}
            {report.sections.map((section, idx) => (
              <div key={idx}>
                <h4 className="font-semibold mb-2">{section.title}</h4>
                {section.data.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No data available</p>
                ) : (
                  <div className="border rounded-lg overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          {section.columns.map((col) => (
                            <th key={col.key} className="px-3 py-2 text-left font-medium text-muted-foreground">{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.data.slice(0, 100).map((row, i) => (
                          <tr key={i} className="border-t">
                            {section.columns.map((col) => (
                              <td key={col.key} className="px-3 py-2">{String(row[col.key] || "—")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {section.data.length > 100 && (
                      <p className="text-xs text-center py-2 text-muted-foreground">
                        Showing 100 of {section.data.length} rows. Export CSV for full data.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {!report ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={generateReport} disabled={isGenerating}>
                {isGenerating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><FileText className="mr-2 h-4 w-4" /> Generate Report</>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setReport(null)}>New Report</Button>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LogisticsReportGenerator;
