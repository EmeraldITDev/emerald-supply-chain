import { useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  FolderKanban, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Plus, 
  Search, 
  Calendar,
  DollarSign,
  Users,
  Package,
  Truck,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { ExportMenu } from "@/components/ExportMenu";
import { toast } from "sonner";
import { exportToCSV, exportToExcel, exportToJSON } from "@/utils/exportData";

interface Project {
  id: string;
  code: string;
  name: string;
  description: string;
  status: "planning" | "in-progress" | "completed" | "on-hold" | "at-risk";
  priority: "low" | "medium" | "high" | "critical";
  department: string;
  manager: string;
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  progress: number;
  milestones: Milestone[];
  resources: Resource[];
  linkedMRFs: number;
  linkedPOs: number;
  linkedShipments: number;
}

interface Milestone {
  id: string;
  name: string;
  dueDate: string;
  completed: boolean;
}

interface Resource {
  type: string;
  name: string;
  quantity: number;
  allocated: number;
}

const mockProjects: Project[] = [
  {
    id: "1",
    code: "PRJ-2024-001",
    name: "Warehouse Expansion",
    description: "Expand warehouse capacity by 40% to accommodate growth",
    status: "in-progress",
    priority: "high",
    department: "Operations",
    manager: "Sarah Johnson",
    startDate: "2024-01-15",
    endDate: "2024-06-30",
    budget: 450000,
    spent: 285000,
    progress: 63,
    milestones: [
      { id: "m1", name: "Site Preparation", dueDate: "2024-02-15", completed: true },
      { id: "m2", name: "Foundation Work", dueDate: "2024-03-30", completed: true },
      { id: "m3", name: "Structure Assembly", dueDate: "2024-05-15", completed: false },
      { id: "m4", name: "Final Inspection", dueDate: "2024-06-30", completed: false },
    ],
    resources: [
      { type: "Personnel", name: "Construction Crew", quantity: 12, allocated: 12 },
      { type: "Equipment", name: "Heavy Machinery", quantity: 5, allocated: 5 },
      { type: "Materials", name: "Steel Beams", quantity: 200, allocated: 126 },
    ],
    linkedMRFs: 8,
    linkedPOs: 12,
    linkedShipments: 15
  },
  {
    id: "2",
    code: "PRJ-2024-002",
    name: "ERP System Implementation",
    description: "Deploy new enterprise resource planning system",
    status: "in-progress",
    priority: "critical",
    department: "IT",
    manager: "Michael Chen",
    startDate: "2024-02-01",
    endDate: "2024-08-31",
    budget: 680000,
    spent: 320000,
    progress: 47,
    milestones: [
      { id: "m1", name: "Requirements Analysis", dueDate: "2024-02-28", completed: true },
      { id: "m2", name: "System Configuration", dueDate: "2024-04-30", completed: true },
      { id: "m3", name: "Data Migration", dueDate: "2024-06-30", completed: false },
      { id: "m4", name: "User Training", dueDate: "2024-07-31", completed: false },
      { id: "m5", name: "Go-Live", dueDate: "2024-08-31", completed: false },
    ],
    resources: [
      { type: "Personnel", name: "IT Staff", quantity: 8, allocated: 8 },
      { type: "Software", name: "ERP Licenses", quantity: 150, allocated: 150 },
      { type: "Services", name: "Consulting Hours", quantity: 500, allocated: 235 },
    ],
    linkedMRFs: 5,
    linkedPOs: 7,
    linkedShipments: 3
  },
  {
    id: "3",
    code: "PRJ-2024-003",
    name: "Fleet Modernization",
    description: "Replace aging delivery vehicles with modern fleet",
    status: "at-risk",
    priority: "high",
    department: "Logistics",
    manager: "David Rodriguez",
    startDate: "2024-01-10",
    endDate: "2024-05-31",
    budget: 890000,
    spent: 612000,
    progress: 58,
    milestones: [
      { id: "m1", name: "Vendor Selection", dueDate: "2024-01-31", completed: true },
      { id: "m2", name: "Vehicle Orders", dueDate: "2024-02-28", completed: true },
      { id: "m3", name: "Delivery & Setup", dueDate: "2024-04-30", completed: false },
      { id: "m4", name: "Driver Training", dueDate: "2024-05-31", completed: false },
    ],
    resources: [
      { type: "Vehicles", name: "Delivery Trucks", quantity: 15, allocated: 8 },
      { type: "Personnel", name: "Drivers", quantity: 20, allocated: 20 },
      { type: "Equipment", name: "GPS Systems", quantity: 15, allocated: 8 },
    ],
    linkedMRFs: 3,
    linkedPOs: 6,
    linkedShipments: 8
  },
  {
    id: "4",
    code: "PRJ-2024-004",
    name: "Safety Compliance Upgrade",
    description: "Update facilities to meet new safety standards",
    status: "completed",
    priority: "medium",
    department: "Safety",
    manager: "Lisa Anderson",
    startDate: "2023-11-01",
    endDate: "2024-01-31",
    budget: 125000,
    spent: 118500,
    progress: 100,
    milestones: [
      { id: "m1", name: "Safety Audit", dueDate: "2023-11-30", completed: true },
      { id: "m2", name: "Equipment Installation", dueDate: "2023-12-31", completed: true },
      { id: "m3", name: "Staff Training", dueDate: "2024-01-15", completed: true },
      { id: "m4", name: "Final Certification", dueDate: "2024-01-31", completed: true },
    ],
    resources: [
      { type: "Equipment", name: "Safety Gear", quantity: 150, allocated: 150 },
      { type: "Services", name: "Training Sessions", quantity: 12, allocated: 12 },
      { type: "Materials", name: "Signage", quantity: 80, allocated: 80 },
    ],
    linkedMRFs: 4,
    linkedPOs: 5,
    linkedShipments: 6
  },
  {
    id: "5",
    code: "PRJ-2024-005",
    name: "Sustainability Initiative",
    description: "Implement green energy and waste reduction programs",
    status: "planning",
    priority: "medium",
    department: "Facilities",
    manager: "Emma Wilson",
    startDate: "2024-03-01",
    endDate: "2024-12-31",
    budget: 350000,
    spent: 28000,
    progress: 8,
    milestones: [
      { id: "m1", name: "Environmental Assessment", dueDate: "2024-03-31", completed: true },
      { id: "m2", name: "Solar Panel Installation", dueDate: "2024-06-30", completed: false },
      { id: "m3", name: "Recycling Program Launch", dueDate: "2024-09-30", completed: false },
      { id: "m4", name: "Energy Audit", dueDate: "2024-12-31", completed: false },
    ],
    resources: [
      { type: "Equipment", name: "Solar Panels", quantity: 200, allocated: 0 },
      { type: "Personnel", name: "Technicians", quantity: 6, allocated: 2 },
      { type: "Materials", name: "Recycling Bins", quantity: 100, allocated: 100 },
    ],
    linkedMRFs: 2,
    linkedPOs: 3,
    linkedShipments: 1
  }
];

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Calculate metrics
  const metrics = useMemo(() => {
    const activeCount = projects.filter(p => 
      p.status === "in-progress" || p.status === "planning"
    ).length;
    const inProgressCount = projects.filter(p => p.status === "in-progress").length;
    const completedCount = projects.filter(p => p.status === "completed").length;
    const atRiskCount = projects.filter(p => p.status === "at-risk").length;

    return { activeCount, inProgressCount, completedCount, atRiskCount };
  }, [projects]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      const matchesSearch = 
        project.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.manager.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || project.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [projects, searchQuery, statusFilter, priorityFilter]);

  const handleCreateProject = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newProject: Project = {
      id: String(projects.length + 1),
      code: `PRJ-2024-${String(projects.length + 1).padStart(3, '0')}`,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      status: formData.get("status") as any,
      priority: formData.get("priority") as any,
      department: formData.get("department") as string,
      manager: formData.get("manager") as string,
      startDate: formData.get("startDate") as string,
      endDate: formData.get("endDate") as string,
      budget: Number(formData.get("budget")),
      spent: 0,
      progress: 0,
      milestones: [],
      resources: [],
      linkedMRFs: 0,
      linkedPOs: 0,
      linkedShipments: 0
    };

    setProjects([newProject, ...projects]);
    setNewProjectOpen(false);
    toast.success(`Project ${newProject.code} created successfully`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success">Completed</Badge>;
      case "in-progress":
        return <Badge className="bg-info">In Progress</Badge>;
      case "planning":
        return <Badge variant="secondary">Planning</Badge>;
      case "on-hold":
        return <Badge variant="outline">On Hold</Badge>;
      case "at-risk":
        return <Badge variant="destructive">At Risk</Badge>;
      default:
        return null;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return <Badge className="bg-warning">High</Badge>;
      case "medium":
        return <Badge variant="secondary">Medium</Badge>;
      case "low":
        return <Badge variant="outline">Low</Badge>;
      default:
        return null;
    }
  };

  const getBudgetStatus = (budget: number, spent: number) => {
    const percentage = (spent / budget) * 100;
    const remaining = budget - spent;
    const isOverBudget = spent > budget;

    return {
      percentage: Math.min(percentage, 100),
      remaining,
      isOverBudget,
      variance: spent - budget
    };
  };

  const handleExport = (format: 'csv' | 'excel' | 'json') => {
    const exportData = filteredProjects.map(p => ({
      'Project Code': p.code,
      'Name': p.name,
      'Status': p.status,
      'Priority': p.priority,
      'Manager': p.manager,
      'Department': p.department,
      'Budget': p.budget,
      'Spent': p.spent,
      'Progress': `${p.progress}%`,
      'Start Date': p.startDate,
      'End Date': p.endDate,
    }));

    switch (format) {
      case 'csv':
        exportToCSV(exportData, 'projects');
        break;
      case 'excel':
        exportToExcel(exportData, 'projects');
        break;
      case 'json':
        exportToJSON(exportData, 'projects');
        break;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderKanban className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Project Tracking</h1>
              <p className="text-muted-foreground">Monitor project progress and costs</p>
            </div>
          </div>
          <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-card max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Define a new project with timeline and budget
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Project Name *</Label>
                    <Input id="name" name="name" required placeholder="e.g., Warehouse Expansion" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manager">Project Manager *</Label>
                    <Input id="manager" name="manager" required placeholder="e.g., John Doe" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea id="description" name="description" required placeholder="Brief project description" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department *</Label>
                    <Select name="department" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="Operations">Operations</SelectItem>
                        <SelectItem value="IT">IT</SelectItem>
                        <SelectItem value="Logistics">Logistics</SelectItem>
                        <SelectItem value="Facilities">Facilities</SelectItem>
                        <SelectItem value="Engineering">Engineering</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority *</Label>
                    <Select name="priority" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select name="status" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="planning">Planning</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="on-hold">On Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="budget">Budget ($) *</Label>
                    <Input id="budget" name="budget" type="number" step="0.01" required placeholder="0.00" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input id="startDate" name="startDate" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input id="endDate" name="endDate" type="date" required />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setNewProjectOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Project</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeCount}</div>
              <p className="text-xs text-muted-foreground">Across all departments</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Clock className="h-4 w-4 text-info" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.inProgressCount}</div>
              <p className="text-xs text-muted-foreground">Currently executing</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.completedCount}</div>
              <p className="text-xs text-muted-foreground">This quarter</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">At Risk</CardTitle>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.atRiskCount}</div>
              <p className="text-xs text-muted-foreground">Requires attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code, name, or manager..."
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
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                  <SelectItem value="at-risk">At Risk</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <ExportMenu onExport={handleExport} />
            </div>
          </CardContent>
        </Card>

        {/* Projects Grid */}
        <div className="grid gap-4">
          {filteredProjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No projects found</p>
              </CardContent>
            </Card>
          ) : (
            filteredProjects.map((project) => {
              const budgetStatus = getBudgetStatus(project.budget, project.spent);
              const completedMilestones = project.milestones.filter(m => m.completed).length;

              return (
                <Card key={project.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl">{project.name}</CardTitle>
                          {getStatusBadge(project.status)}
                          {getPriorityBadge(project.priority)}
                        </div>
                        <CardDescription className="flex items-center gap-4 text-sm">
                          <span className="font-mono">{project.code}</span>
                          <span>•</span>
                          <span>{project.department}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {project.manager}
                          </span>
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedProject(project)}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{project.description}</p>

                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Progress</span>
                        <span className="text-muted-foreground">{project.progress}%</span>
                      </div>
                      <Progress value={project.progress} className="h-2" />
                    </div>

                    {/* Budget */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Budget Utilization</span>
                        <span className={budgetStatus.isOverBudget ? "text-destructive" : "text-muted-foreground"}>
                          ${project.spent.toLocaleString()} / ${project.budget.toLocaleString()}
                        </span>
                      </div>
                      <Progress 
                        value={budgetStatus.percentage} 
                        className={`h-2 ${budgetStatus.isOverBudget ? '[&>div]:bg-destructive' : ''}`}
                      />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          Remaining: ${budgetStatus.remaining.toLocaleString()}
                        </span>
                        {budgetStatus.isOverBudget && (
                          <span className="text-destructive flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" />
                            Over by ${Math.abs(budgetStatus.variance).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                          <Calendar className="h-3 w-3" />
                          Timeline
                        </div>
                        <p className="text-xs font-medium">
                          {new Date(project.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(project.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                          <CheckCircle className="h-3 w-3" />
                          Milestones
                        </div>
                        <p className="text-xs font-medium">
                          {completedMilestones}/{project.milestones.length}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                          <Package className="h-3 w-3" />
                          MRFs/POs
                        </div>
                        <p className="text-xs font-medium">
                          {project.linkedMRFs}/{project.linkedPOs}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                          <Truck className="h-3 w-3" />
                          Shipments
                        </div>
                        <p className="text-xs font-medium">
                          {project.linkedShipments}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Project Details Dialog */}
        <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
          <DialogContent className="max-w-4xl bg-card max-h-[90vh] overflow-y-auto">
            {selectedProject && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <DialogTitle className="text-2xl">{selectedProject.name}</DialogTitle>
                    {getStatusBadge(selectedProject.status)}
                    {getPriorityBadge(selectedProject.priority)}
                  </div>
                  <DialogDescription>
                    {selectedProject.code} • Managed by {selectedProject.manager}
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="overview" className="space-y-4">
                  <TabsList className="bg-muted">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="milestones">Milestones</TabsTrigger>
                    <TabsTrigger value="resources">Resources</TabsTrigger>
                    <TabsTrigger value="linked">Linked Items</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Description</h4>
                      <p className="text-sm text-muted-foreground">{selectedProject.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Timeline</h4>
                        <div className="space-y-1 text-sm">
                          <p><span className="text-muted-foreground">Start:</span> {selectedProject.startDate}</p>
                          <p><span className="text-muted-foreground">End:</span> {selectedProject.endDate}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Budget</h4>
                        <div className="space-y-1 text-sm">
                          <p><span className="text-muted-foreground">Allocated:</span> ${selectedProject.budget.toLocaleString()}</p>
                          <p><span className="text-muted-foreground">Spent:</span> ${selectedProject.spent.toLocaleString()}</p>
                          <p><span className="text-muted-foreground">Remaining:</span> ${(selectedProject.budget - selectedProject.spent).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="milestones">
                    <div className="space-y-3">
                      {selectedProject.milestones.map((milestone) => (
                        <div key={milestone.id} className="flex items-center gap-3 p-3 border rounded-lg">
                          {milestone.completed ? (
                            <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
                          ) : (
                            <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className={`font-medium ${milestone.completed ? 'line-through text-muted-foreground' : ''}`}>
                              {milestone.name}
                            </p>
                            <p className="text-xs text-muted-foreground">Due: {milestone.dueDate}</p>
                          </div>
                          {milestone.completed ? (
                            <Badge className="bg-success">Completed</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="resources">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Resource</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Allocated</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedProject.resources.map((resource, idx) => {
                          const allocationPercent = (resource.allocated / resource.quantity) * 100;
                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{resource.type}</TableCell>
                              <TableCell>{resource.name}</TableCell>
                              <TableCell>{resource.quantity}</TableCell>
                              <TableCell>{resource.allocated}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={allocationPercent} className="h-2 w-20" />
                                  <span className="text-xs text-muted-foreground">{allocationPercent.toFixed(0)}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TabsContent>

                  <TabsContent value="linked">
                    <div className="grid grid-cols-3 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            Material Requests
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{selectedProject.linkedMRFs}</div>
                          <Button variant="link" size="sm" className="p-0 h-auto">View All</Button>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Purchase Orders
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{selectedProject.linkedPOs}</div>
                          <Button variant="link" size="sm" className="p-0 h-auto">View All</Button>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Truck className="h-4 w-4" />
                            Shipments
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold">{selectedProject.linkedShipments}</div>
                          <Button variant="link" size="sm" className="p-0 h-auto">View All</Button>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
