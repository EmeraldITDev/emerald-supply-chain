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
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface MRNItemForm {
  name: string;
  description: string;
  quantity: string;
  estimatedUnitCost: string;
}

const NewMRN = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addMRN } = useApp();

  const [formData, setFormData] = useState({
    title: "",
    department: user?.department || "",
    category: "",
    urgency: "Medium" as "Low" | "Medium" | "High",
    justification: "",
  });

  const [items, setItems] = useState<MRNItemForm[]>([
    { name: "", description: "", quantity: "", estimatedUnitCost: "" }
  ]);

  const addItem = () => {
    setItems([...items, { name: "", description: "", quantity: "", estimatedUnitCost: "" }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof MRNItemForm, value: string) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.title || !formData.category || !formData.justification) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const hasEmptyItems = items.some(item => 
      !item.name || !item.quantity || !item.estimatedUnitCost
    );

    if (hasEmptyItems) {
      toast({
        title: "Validation Error",
        description: "Please complete all item details",
        variant: "destructive",
      });
      return;
    }

    addMRN({
      ...formData,
      items: items.map(item => ({
        ...item,
        quantity: item.quantity,
        estimatedUnitCost: item.estimatedUnitCost,
      })),
    });

    toast({
      title: "MRN Submitted",
      description: "Your material request note has been submitted for review",
    });

    navigate("/department");
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/department")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">New Material Request Note</h1>
            <p className="text-muted-foreground">
              Submit a request for materials needed by your department
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Request Information</CardTitle>
              <CardDescription>Basic details about your material request</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="title">Request Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Office Supplies for Q1"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department *</Label>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="office-supplies">Office Supplies</SelectItem>
                      <SelectItem value="raw-materials">Raw Materials</SelectItem>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="it-hardware">IT Hardware</SelectItem>
                      <SelectItem value="maintenance">Maintenance Supplies</SelectItem>
                      <SelectItem value="safety">Safety Equipment</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="urgency">Urgency Level *</Label>
                  <Select
                    value={formData.urgency}
                    onValueChange={(value: "Low" | "Medium" | "High") => 
                      setFormData({ ...formData, urgency: value })
                    }
                  >
                    <SelectTrigger id="urgency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">Low</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="High">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="justification">Justification *</Label>
                <Textarea
                  id="justification"
                  placeholder="Explain why these materials are needed..."
                  value={formData.justification}
                  onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                  rows={4}
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Required Items</CardTitle>
                  <CardDescription>List all materials you need</CardDescription>
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

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Item Name *</Label>
                        <Input
                          placeholder="e.g., A4 Paper"
                          value={item.name}
                          onChange={(e) => updateItem(index, "name", e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Quantity *</Label>
                        <Input
                          placeholder="e.g., 50 reams"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Estimated Unit Cost (₦) *</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={item.estimatedUnitCost}
                          onChange={(e) => updateItem(index, "estimatedUnitCost", e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label>Description</Label>
                        <Textarea
                          placeholder="Additional details about the item..."
                          value={item.description}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                          rows={2}
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
              Submit MRN
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default NewMRN;
