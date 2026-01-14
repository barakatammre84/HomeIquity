import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useLocation } from "wouter";
import type { Task, LoanApplication, User } from "@shared/schema";
import {
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  User as UserIcon,
  ChevronRight,
  Search,
  Calendar,
  Upload,
  Eye,
  X,
} from "lucide-react";
import { format } from "date-fns";

interface StaffData {
  applications: (LoanApplication & { user?: User })[];
  users: User[];
}

const documentCategories = [
  { value: "tax_return", label: "Tax Return" },
  { value: "w2", label: "W-2 Form" },
  { value: "pay_stub", label: "Pay Stub" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "id", label: "Government ID" },
  { value: "other", label: "Other Document" },
];

const documentYears = ["2024", "2023", "2022", "2021"];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "secondary", label: "Pending" },
    in_progress: { variant: "default", label: "In Progress" },
    submitted: { variant: "outline", label: "Submitted" },
    verified: { variant: "default", label: "Verified" },
    rejected: { variant: "destructive", label: "Rejected" },
    completed: { variant: "default", label: "Completed" },
  };
  const config = statusConfig[status] || { variant: "secondary" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getPriorityBadge(priority: string) {
  const config: Record<string, { className: string; label: string }> = {
    low: { className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", label: "Low" },
    normal: { className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", label: "Normal" },
    high: { className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", label: "High" },
    urgent: { className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", label: "Urgent" },
  };
  const p = config[priority] || config.normal;
  return <Badge className={p.className}>{p.label}</Badge>;
}

export default function StaffDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("tasks");

  const isStaff = ["admin", "lender", "broker"].includes(user?.role || "");

  useEffect(() => {
    if (!authLoading && !isStaff) {
      navigate("/dashboard");
    }
  }, [authLoading, isStaff, navigate]);

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    taskType: "document_request",
    documentCategory: "",
    documentYear: "",
    documentInstructions: "",
    priority: "normal",
    dueDate: "",
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !authLoading && !!user,
  });

  const { data: applicationsData, isLoading: applicationsLoading } = useQuery<LoanApplication[]>({
    queryKey: ["/api/admin/applications"],
    enabled: !authLoading && !!user && ["admin", "lender", "broker"].includes(user.role || ""),
  });

  const { data: usersData } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !authLoading && !!user && ["admin", "lender", "broker"].includes(user.role || ""),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      const response = await apiRequest("POST", "/api/tasks", taskData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task Created",
        description: "The task has been created and assigned to the borrower.",
      });
      setCreateDialogOpen(false);
      resetNewTaskForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create task",
        variant: "destructive",
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const response = await apiRequest("PATCH", `/api/tasks/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Task Updated",
        description: "The task has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const resetNewTaskForm = () => {
    setNewTask({
      title: "",
      description: "",
      taskType: "document_request",
      documentCategory: "",
      documentYear: "",
      documentInstructions: "",
      priority: "normal",
      dueDate: "",
    });
    setSelectedApplication("");
  };

  const handleCreateTask = () => {
    if (!selectedApplication) {
      toast({
        title: "Error",
        description: "Please select an application",
        variant: "destructive",
      });
      return;
    }

    const application = applicationsData?.find(app => app.id === selectedApplication);
    if (!application) return;

    const taskTitle = newTask.documentCategory && newTask.documentYear
      ? `Upload ${newTask.documentYear} ${documentCategories.find(c => c.value === newTask.documentCategory)?.label}`
      : newTask.title;

    createTaskMutation.mutate({
      applicationId: selectedApplication,
      assignedToUserId: application.userId,
      title: taskTitle,
      description: newTask.description,
      taskType: newTask.taskType,
      documentCategory: newTask.documentCategory || null,
      documentYear: newTask.documentYear || null,
      documentInstructions: newTask.documentInstructions || null,
      priority: newTask.priority,
      dueDate: newTask.dueDate ? new Date(newTask.dueDate) : null,
    });
  };

  if (authLoading || tasksLoading || applicationsLoading) {
    return (
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex-1 p-8">
            <Skeleton className="mb-8 h-8 w-48" />
            <div className="space-y-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  if (!user || !["admin", "lender", "broker"].includes(user.role || "")) {
    return (
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex-1 flex items-center justify-center">
            <Card className="max-w-md">
              <CardContent className="p-8 text-center">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                <p className="text-muted-foreground">
                  You do not have permission to access the staff dashboard.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  const tasks = tasksData || [];
  const applications = applicationsData || [];
  const users = usersData || [];

  const filteredTasks = tasks.filter(task => {
    const searchLower = searchTerm.toLowerCase();
    return (
      task.title.toLowerCase().includes(searchLower) ||
      task.status.toLowerCase().includes(searchLower)
    );
  });

  const pendingTasks = tasks.filter(t => t.status === "pending");
  const submittedTasks = tasks.filter(t => t.status === "submitted");
  const verifiedTasks = tasks.filter(t => t.status === "verified");

  const getUserName = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email : "Unknown";
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="border-b p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="text-staff-dashboard-title">
                  Staff Dashboard
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage borrower tasks and document verification
                </p>
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-task">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                    <DialogDescription>
                      Assign a task to a borrower for document collection or verification.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="application">Select Application</Label>
                      <Select value={selectedApplication} onValueChange={setSelectedApplication}>
                        <SelectTrigger data-testid="select-application">
                          <SelectValue placeholder="Choose an application" />
                        </SelectTrigger>
                        <SelectContent>
                          {applications.map(app => (
                            <SelectItem key={app.id} value={app.id}>
                              {getUserName(app.userId)} - {app.status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="taskType">Task Type</Label>
                      <Select
                        value={newTask.taskType}
                        onValueChange={(v) => setNewTask({ ...newTask, taskType: v })}
                      >
                        <SelectTrigger data-testid="select-task-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="document_request">Document Request</SelectItem>
                          <SelectItem value="verification">Verification</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="action">Action Required</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {newTask.taskType === "document_request" && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="documentCategory">Document Type</Label>
                            <Select
                              value={newTask.documentCategory}
                              onValueChange={(v) => setNewTask({ ...newTask, documentCategory: v })}
                            >
                              <SelectTrigger data-testid="select-document-category">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                {documentCategories.map(cat => (
                                  <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="documentYear">Year</Label>
                            <Select
                              value={newTask.documentYear}
                              onValueChange={(v) => setNewTask({ ...newTask, documentYear: v })}
                            >
                              <SelectTrigger data-testid="select-document-year">
                                <SelectValue placeholder="Select year" />
                              </SelectTrigger>
                              <SelectContent>
                                {documentYears.map(year => (
                                  <SelectItem key={year} value={year}>
                                    {year}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="instructions">Instructions for Borrower</Label>
                          <Textarea
                            id="instructions"
                            placeholder="e.g., Please upload your complete tax return including all schedules..."
                            value={newTask.documentInstructions}
                            onChange={(e) => setNewTask({ ...newTask, documentInstructions: e.target.value })}
                            data-testid="input-document-instructions"
                          />
                        </div>
                      </>
                    )}

                    {newTask.taskType !== "document_request" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="title">Task Title</Label>
                          <Input
                            id="title"
                            placeholder="Enter task title"
                            value={newTask.title}
                            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                            data-testid="input-task-title"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            placeholder="Describe what needs to be done..."
                            value={newTask.description}
                            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                            data-testid="input-task-description"
                          />
                        </div>
                      </>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="priority">Priority</Label>
                        <Select
                          value={newTask.priority}
                          onValueChange={(v) => setNewTask({ ...newTask, priority: v })}
                        >
                          <SelectTrigger data-testid="select-priority">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {priorityOptions.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dueDate">Due Date</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={newTask.dueDate}
                          onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                          data-testid="input-due-date"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateTask}
                      disabled={createTaskMutation.isPending}
                      data-testid="button-submit-task"
                    >
                      {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            <div className="grid gap-4 md:grid-cols-3 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                      <Clock className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-pending-count">{pendingTasks.length}</p>
                      <p className="text-sm text-muted-foreground">Pending Tasks</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-submitted-count">{submittedTasks.length}</p>
                      <p className="text-sm text-muted-foreground">Awaiting Review</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-verified-count">{verifiedTasks.length}</p>
                      <p className="text-sm text-muted-foreground">Verified</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="tasks" data-testid="tab-tasks">All Tasks</TabsTrigger>
                <TabsTrigger value="review" data-testid="tab-review">Needs Review ({submittedTasks.length})</TabsTrigger>
                <TabsTrigger value="applications" data-testid="tab-applications">Applications</TabsTrigger>
              </TabsList>

              <TabsContent value="tasks">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle>All Tasks</CardTitle>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search tasks..."
                          className="pl-9 w-64"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          data-testid="input-search-tasks"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredTasks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="mx-auto h-12 w-12 mb-4" />
                        <p>No tasks found</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredTasks.map(task => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between rounded-lg border p-4 hover-elevate"
                            data-testid={`task-row-${task.id}`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                <FileText className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-medium">{task.title}</p>
                                <p className="text-sm text-muted-foreground">
                                  Assigned to: {getUserName(task.assignedToUserId)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {getPriorityBadge(task.priority || "normal")}
                              {getStatusBadge(task.status)}
                              {task.dueDate && (
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {format(new Date(task.dueDate), "MMM d")}
                                </span>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/task/${task.id}`)}
                                data-testid={`button-view-task-${task.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="review">
                <Card>
                  <CardHeader>
                    <CardTitle>Tasks Awaiting Review</CardTitle>
                    <CardDescription>
                      Review uploaded documents and verify borrower information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {submittedTasks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="mx-auto h-12 w-12 mb-4" />
                        <p>No tasks awaiting review</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {submittedTasks.map(task => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between rounded-lg border p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                            data-testid={`review-task-${task.id}`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-800">
                                <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <p className="font-medium">{task.title}</p>
                                <p className="text-sm text-muted-foreground">
                                  Submitted by: {getUserName(task.assignedToUserId)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: "rejected", verificationStatus: "rejected" } })}
                                data-testid={`button-reject-${task.id}`}
                              >
                                <X className="mr-1 h-4 w-4" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: "verified", verificationStatus: "verified" } })}
                                data-testid={`button-verify-${task.id}`}
                              >
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                Verify
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="applications">
                <Card>
                  <CardHeader>
                    <CardTitle>All Applications</CardTitle>
                    <CardDescription>
                      View borrower applications and assign tasks
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {applications.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <UserIcon className="mx-auto h-12 w-12 mb-4" />
                        <p>No applications found</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {applications.map(app => (
                          <div
                            key={app.id}
                            className="flex items-center justify-between rounded-lg border p-4 hover-elevate"
                            data-testid={`application-row-${app.id}`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                <UserIcon className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-medium">{getUserName(app.userId)}</p>
                                <p className="text-sm text-muted-foreground">
                                  {app.propertyState ? `Property in ${app.propertyState}` : "No property"} 
                                  {app.purchasePrice ? ` - $${Number(app.purchasePrice).toLocaleString()}` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {getStatusBadge(app.status)}
                              <span className="text-sm text-muted-foreground">
                                {tasks.filter(t => t.applicationId === app.id).length} tasks
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedApplication(app.id);
                                  setCreateDialogOpen(true);
                                }}
                                data-testid={`button-add-task-${app.id}`}
                              >
                                <Plus className="mr-1 h-4 w-4" />
                                Add Task
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
