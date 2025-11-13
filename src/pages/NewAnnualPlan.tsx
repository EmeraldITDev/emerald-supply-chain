import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AnnualPlanItemForm {
  category: string;
  itemDescription: string;
  estimatedQuantity: string;
  estimatedCost: string;
  priority: "High" | "Medium" | "Low";
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  justification: string;
}

const NewAnnualPlan = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addAnnualPlan } = useApp();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear + 1);

  const [items, setItems] = useState<AnnualPlanItemForm[]>([
    {
      category: "",
      itemDescription: "",
      estimatedQuantity: "",
      estimatedCost: "",
      priority: "Medium",
      quarter: "Q1",
      justification: "",
    }
  ]);

  const addItem = () => {
    setItems([...items, {
      category: "",
      itemDescription: "",
      estimatedQuantity: "",
      estimatedCost: "",
      priority: "Medium",
      quarter: "Q1",
      justification: "",
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof AnnualPlanItemForm, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const hasEmptyItems = items.some(item => 
      !item.category || !item.itemDescription || !item.estimatedQuantity || 
      !item.estimatedCost || !item.justification
    );

    if (hasEmptyItems) {
      toast({
        title: "Validation Error",
        description: "Please complete all item details",
        variant: "destructive",
      });
      return;
    }

    addAnnualPlan({
      year,
      department: user?.department || "",
      items: items,
    });

    toast({
      title: "Annual Plan Submitted",
      description: `Your FY${year} procurement plan has been submitted for review`,
    });

    navigate("/department");
  };

  const totalBudget = items.reduce((sum, item) => 
    sum + (parseFloat(item.estimatedCost) || 0), 0
  );

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/department")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Annual Procurement Plan</h1>
            <p className="text-muted-foreground">
              Plan your department's material needs for the upcoming fiscal year
            </p>
          </div>
        </div>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Calendar className="h-10 w-10 text-primary" />
              <div className="flex-1">
                <h3 className="font-semibold">Planning for FY {year}</h3>
                <p className="text-sm text-muted-foreground">
                  Submit your annual material requirements to reduce ad-hoc procurement throughout the year
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Estimated Total Budget</div>
                <div className="text-2xl font-bold">₦{totalBudget.toLocaleString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Planned Items</CardTitle>
                  <CardDescription>List all materials you anticipate needing</CardDescription>
                </div>
                <Button type="button" variant="outline" onClick={addItem}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <Card key={index}>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">Item {index + 1}</h4>
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Category *</Label>
                        <Select
                          value={item.category}
                          onValueChange={(value) => updateItem(index, "category", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="office-supplies">Office Supplies</SelectItem>
                            <SelectItem value="raw-materials">Raw Materials</SelectItem>
                            <SelectItem value="equipment">Equipment</SelectItem>
                            <SelectItem value="it-hardware">IT Hardware</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="safety">Safety Equipment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Priority *</Label>
                        <Select
                          value={item.priority}
                          onValueChange={(value: "High" | "Medium" | "Low") => 
                            updateItem(index, "priority", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="High">High</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Target Quarter *</Label>
                        <Select
                          value={item.quarter}
                          onValueChange={(value: "Q1" | "Q2" | "Q3" | "Q4") => 
                            updateItem(index, "quarter", value)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Q1">Q1 (Jan-Mar)</SelectItem>
                            <SelectItem value="Q2">Q2 (Apr-Jun)</SelectItem>
                            <SelectItem value="Q3">Q3 (Jul-Sep)</SelectItem>
                            <SelectItem value="Q4">Q4 (Oct-Dec)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>Item Description *</Label>
                        <Input
                          placeholder="Describe the material or service needed"
                          value={item.itemDescription}
                          onChange={(e) => updateItem(index, "itemDescription", e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Estimated Quantity *</Label>
                        <Input
                          placeholder="e.g., 100 units"
                          value={item.estimatedQuantity}
                          onChange={(e) => updateItem(index, "estimatedQuantity", e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Estimated Cost (₦) *</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={item.estimatedCost}
                          onChange={(e) => updateItem(index, "estimatedCost", e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2 md:col-span-3">
                        <Label>Justification *</Label>
                        <Textarea
                          placeholder="Explain why this item is needed..."
                          value={item.justification}
                          onChange={(e) => updateItem(index, "justification", e.target.value)}
                          rows={2}
                          required
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate("/department")}>
              Cancel
            </Button>
            <Button type="submit">
              Submit Annual Plan
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default NewAnnualPlan;
