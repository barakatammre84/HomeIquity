import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import type { LoanApplication } from "@shared/schema";
import {
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Upload,
  CreditCard,
  Home,
  User,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

interface DashboardData {
  applications: LoanApplication[];
}

const taskCategories = [
  {
    title: "Verify your identity",
    description: "Help us confirm who you are",
    icon: User,
    tasks: [
      { name: "Verify your identity", completed: false, required: true },
      { name: "Authorize credit check", completed: false, required: true },
    ],
  },
  {
    title: "Income & employment",
    description: "Confirm your income sources",
    icon: CreditCard,
    tasks: [
      { name: "Upload pay stubs", completed: false, required: true },
      { name: "Upload W-2 forms", completed: false, required: true },
      { name: "Verify employment", completed: false, required: false },
    ],
  },
  {
    title: "Assets & accounts",
    description: "Connect your bank accounts",
    icon: CreditCard,
    tasks: [
      { name: "Link bank accounts", completed: false, required: true },
      { name: "Upload bank statements", completed: false, required: false },
    ],
  },
  {
    title: "Property information",
    description: "Provide details about the property",
    icon: Home,
    tasks: [
      { name: "Property address", completed: true, required: true },
      { name: "Purchase agreement", completed: false, required: false },
      { name: "Property inspection", completed: false, required: false },
    ],
  },
];

export default function Tasks() {
  const { isLoading: authLoading } = useAuth();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: !authLoading,
  });

  if (authLoading || isLoading) {
    return (
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex-1 p-8">
            <Skeleton className="mb-8 h-8 w-48" />
            <div className="space-y-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  const applications = data?.applications || [];
  const activeApplication = applications.find(
    (app) => !["closed", "denied"].includes(app.status)
  );

  const totalTasks = taskCategories.reduce((sum, cat) => sum + cat.tasks.length, 0);
  const completedTasks = taskCategories.reduce(
    (sum, cat) => sum + cat.tasks.filter((t) => t.completed).length,
    0
  );
  const progressPercent = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="border-b p-4 sm:p-6 lg:p-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tasks</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete these tasks to move forward with your loan
            </p>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold">Your progress</h3>
                    <p className="text-sm text-muted-foreground">
                      {completedTasks} of {totalTasks} tasks completed
                    </p>
                  </div>
                  <div className="flex-1 max-w-md">
                    <Progress value={progressPercent} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {!activeApplication && (
              <Card className="mb-8 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
                <CardContent className="flex items-center gap-4 p-6">
                  <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 shrink-0" />
                  <div>
                    <p className="font-medium">No active application</p>
                    <p className="text-sm text-muted-foreground">
                      Complete your pre-approval to unlock all tasks
                    </p>
                  </div>
                  <Button className="ml-auto shrink-0" data-testid="button-start-preapproval">
                    Start Pre-Approval
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="space-y-6">
              {taskCategories.map((category, categoryIndex) => (
                <Card key={category.title}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <category.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{category.title}</CardTitle>
                        <CardDescription>{category.description}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {category.tasks.filter((t) => t.completed).length}/{category.tasks.length}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {category.tasks.map((task, taskIndex) => (
                        <div
                          key={task.name}
                          className={`flex items-center justify-between rounded-lg border p-4 transition-colors ${
                            task.completed
                              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                              : "hover:bg-muted/50"
                          }`}
                          data-testid={`task-${category.title.toLowerCase().replace(/\s+/g, '-')}-${taskIndex}`}
                        >
                          <div className="flex items-center gap-3">
                            {task.completed ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                            )}
                            <div>
                              <p className={`text-sm font-medium ${task.completed ? "text-green-700 dark:text-green-400" : ""}`}>
                                {task.name}
                              </p>
                              {task.required && !task.completed && (
                                <p className="text-xs text-muted-foreground">Required</p>
                              )}
                            </div>
                          </div>
                          {!task.completed && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1"
                              data-testid={`button-complete-${task.name.toLowerCase().replace(/\s+/g, '-')}`}
                            >
                              Complete
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mt-8">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center gap-4 md:flex-row md:text-left">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
                    <Lock className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Your information is secure</h3>
                    <p className="text-sm text-muted-foreground">
                      We use bank-level encryption to protect your personal and financial information. 
                      Your data is never shared without your explicit permission.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
