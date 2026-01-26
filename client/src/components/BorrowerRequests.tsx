import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Clock, 
  FileText, 
  Upload, 
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Inbox
} from "lucide-react";
import { Link } from "wouter";

interface BorrowerTask {
  id: string;
  applicationId: string;
  title: string;
  description?: string;
  taskType: string;
  taskTypeCode?: string;
  ownerRole?: string;
  slaClass?: string;
  status: string;
  createdAt?: string;
  slaStatus: "green" | "amber" | "red";
  timeRemaining: number | null;
  percentageElapsed: number | null;
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  OPEN: Clock,
  IN_PROGRESS: FileText,
  COMPLETED: CheckCircle2,
  BLOCKED: AlertCircle,
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Awaiting Your Action",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  BLOCKED: "On Hold",
};

const FRIENDLY_TASK_NAMES: Record<string, string> = {
  DOC_PAYSTUB_REQUEST: "Pay Stubs Needed",
  DOC_BANK_STATEMENT_REQUEST: "Bank Statements Needed",
  DOC_TAX_RETURN_REQUEST: "Tax Returns Needed",
  DOC_PURCHASE_CONTRACT: "Purchase Contract Needed",
  DOC_GIFT_LETTER: "Gift Letter Needed",
  INTAKE_CONSENT_CREDIT: "Credit Authorization",
  INTAKE_INITIAL_DISCLOSURES: "Review Disclosures",
  CRD_CREDIT_PULL: "Authorize Credit Check",
  CRD_INQUIRY_LOE: "Explain Credit Inquiries",
  INC_EMP_GAP: "Employment History",
  AST_LARGE_DEPOSIT: "Large Deposit Explanation",
  CMP_ADVERSE_ACTION: "Important Notice",
};

function formatTimeRemaining(minutes: number | null): string {
  if (minutes === null) return "";
  if (minutes <= 0) return "Response needed soon";
  
  if (minutes < 60) return `Due in ${minutes} minutes`;
  if (minutes < 1440) return `Due in ${Math.floor(minutes / 60)} hours`;
  return `Due in ${Math.floor(minutes / 1440)} days`;
}

function RequestCard({ task }: { task: BorrowerTask }) {
  const StatusIcon = STATUS_ICONS[task.status] || Clock;
  const friendlyName = FRIENDLY_TASK_NAMES[task.taskTypeCode || ""] || task.title;
  
  const isActionNeeded = task.status === "OPEN" && task.ownerRole === "BORROWER";
  
  return (
    <div 
      className={`flex items-center justify-between p-4 rounded-lg border ${
        isActionNeeded ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-border"
      }`}
      data-testid={`card-request-${task.id}`}
    >
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-full ${
          task.status === "COMPLETED" 
            ? "bg-emerald-100 dark:bg-emerald-900/20" 
            : isActionNeeded 
              ? "bg-primary/10" 
              : "bg-muted"
        }`}>
          <StatusIcon className={`h-5 w-5 ${
            task.status === "COMPLETED" 
              ? "text-emerald-600" 
              : isActionNeeded 
                ? "text-primary" 
                : "text-muted-foreground"
          }`} />
        </div>
        <div>
          <h4 className="font-medium">{friendlyName}</h4>
          {task.description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {task.description}
            </p>
          )}
          {task.timeRemaining !== null && task.status === "OPEN" && (
            <p className={`text-xs mt-1 ${
              task.slaStatus === "red" ? "text-red-600" : 
              task.slaStatus === "amber" ? "text-amber-600" : 
              "text-muted-foreground"
            }`}>
              {formatTimeRemaining(task.timeRemaining)}
            </p>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {task.status === "COMPLETED" ? (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Done
          </Badge>
        ) : isActionNeeded ? (
          <Link href="/documents">
            <Button size="sm" data-testid={`button-action-${task.id}`}>
              <Upload className="h-4 w-4 mr-2" />
              Take Action
            </Button>
          </Link>
        ) : (
          <Badge variant="outline">
            {STATUS_LABELS[task.status] || task.status}
          </Badge>
        )}
      </div>
    </div>
  );
}

export function BorrowerRequests({ applicationId }: { applicationId?: string }) {
  const { data: tasks, isLoading } = useQuery<BorrowerTask[]>({
    queryKey: ["/api/task-engine/applications", applicationId, "borrower-tasks"],
    enabled: !!applicationId,
  });

  const pendingTasks = tasks?.filter(t => t.status === "OPEN" && t.ownerRole === "BORROWER") || [];
  const inProgressTasks = tasks?.filter(t => t.status !== "OPEN" && t.status !== "COMPLETED") || [];
  const completedTasks = tasks?.filter(t => t.status === "COMPLETED") || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Your Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Your Requests
          </CardTitle>
          <CardDescription>
            Items that need your attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
            <p className="text-muted-foreground">You're all caught up!</p>
            <p className="text-sm text-muted-foreground">No pending requests at this time.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Your Requests
            </CardTitle>
            <CardDescription className="mt-1">
              {pendingTasks.length > 0 
                ? `${pendingTasks.length} item${pendingTasks.length > 1 ? "s" : ""} need your attention`
                : "No pending items"}
            </CardDescription>
          </div>
          {pendingTasks.length > 0 && (
            <Badge variant="default" className="bg-emerald-500">
              {pendingTasks.length} Action{pendingTasks.length > 1 ? "s" : ""} Needed
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingTasks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Action Required
            </h4>
            <div className="space-y-2">
              {pendingTasks.map(task => (
                <RequestCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {inProgressTasks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground mb-3 mt-4">
              In Review
            </h4>
            <div className="space-y-2">
              {inProgressTasks.map(task => (
                <RequestCard key={task.id} task={task} />
              ))}
            </div>
          </div>
        )}

        {completedTasks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground mb-3 mt-4">
              Completed
            </h4>
            <div className="space-y-2">
              {completedTasks.slice(0, 3).map(task => (
                <RequestCard key={task.id} task={task} />
              ))}
              {completedTasks.length > 3 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  +{completedTasks.length - 3} more completed
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default BorrowerRequests;
