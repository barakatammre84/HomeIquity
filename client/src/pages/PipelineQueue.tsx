import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import type { LoanCondition } from "@shared/schema";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  Circle,
  FileText,
  Users,
  ArrowRight,
  Timer,
  AlertCircle,
  TrendingUp,
  MoreHorizontal,
  Eye,
  CheckCheck,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  ChevronRight,
  Calendar,
  User,
  DollarSign,
  ClipboardCheck,
} from "lucide-react";

interface PipelineSummary {
  applicationId: string;
  currentStage: string;
  priority: "urgent" | "high" | "normal";
  daysInPipeline: number;
  estimatedClosingDays: number;
  completionPercentage: number;
  documentsRequired: number;
  documentsReceived: number;
  conditionsTotal: number;
  conditionsCleared: number;
  lastActivityAt: Date;
  assignedLO: string | null;
  targetCloseDate: Date | null;
  borrowerName?: string;
  loanAmount?: string;
}

interface QueueData {
  total: number;
  byPriority: {
    urgent: number;
    high: number;
    normal: number;
  };
  byStage: Record<string, PipelineSummary[]>;
  queue: PipelineSummary[];
}

interface ConditionData {
  conditions: LoanCondition[];
  grouped: {
    priorToApproval: LoanCondition[];
    priorToDocs: LoanCondition[];
    priorToFunding: LoanCondition[];
  };
  stats: {
    total: number;
    outstanding: number;
    submitted: number;
    cleared: number;
    waived: number;
  };
}

const STAGE_ORDER = [
  "pre_approval",
  "processing", 
  "underwriting",
  "conditional_approval",
  "clear_to_close",
  "funded",
];

function formatStageLabel(stage: string): string {
  return stage.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case "urgent": return "bg-red-500";
    case "high": return "bg-orange-500";
    default: return "bg-blue-500";
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "urgent":
      return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Urgent</Badge>;
    case "high":
      return <Badge variant="secondary" className="gap-1 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"><Clock className="h-3 w-3" />High</Badge>;
    default:
      return <Badge variant="secondary"><Circle className="h-3 w-3 fill-current" />Normal</Badge>;
  }
}

export default function PipelineQueue() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [conditionDialogOpen, setConditionDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [clearingCondition, setClearingCondition] = useState<LoanCondition | null>(null);
  const [clearanceNotes, setClearanceNotes] = useState("");

  const { data: queueData, isLoading } = useQuery<QueueData>({
    queryKey: ["/api/pipeline/queue"],
    enabled: !authLoading,
    refetchInterval: 30000,
  });

  const { data: conditionData, isLoading: conditionsLoading } = useQuery<ConditionData>({
    queryKey: [`/api/loan-applications/${selectedApp}/conditions`],
    enabled: !!selectedApp,
  });

  const clearConditionMutation = useMutation({
    mutationFn: async ({ conditionId, notes }: { conditionId: string; notes: string }) => {
      return apiRequest("PATCH", `/api/conditions/${conditionId}`, {
        status: "cleared",
        clearanceNotes: notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/queue"] });
      queryClient.invalidateQueries({ queryKey: [`/api/loan-applications/${selectedApp}/conditions`] });
      toast({
        title: "Condition Cleared",
        description: "The condition has been cleared successfully.",
      });
      setClearingCondition(null);
      setClearanceNotes("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear condition. Please try again.",
        variant: "destructive",
      });
    },
  });

  const advanceStageMutation = useMutation({
    mutationFn: async ({ applicationId, newStage }: { applicationId: string; newStage: string }) => {
      return apiRequest("POST", `/api/loan-applications/${applicationId}/advance-stage`, {
        newStage,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/queue"] });
      toast({
        title: "Stage Advanced",
        description: "Loan has been advanced to the next stage.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cannot Advance",
        description: error.message || "There are blockers preventing stage advancement.",
        variant: "destructive",
      });
    },
  });

  if (authLoading || isLoading) {
    return (
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              <Skeleton className="h-12 w-64" />
              <div className="grid gap-4 md:grid-cols-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
              </div>
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  const queue = queueData?.queue || [];
  const byStage = queueData?.byStage || {};
  const byPriority = queueData?.byPriority || { urgent: 0, high: 0, normal: 0 };

  const filteredQueue = selectedStage === "all" 
    ? queue 
    : queue.filter(item => item.currentStage === selectedStage);

  const handleClearCondition = () => {
    if (!clearingCondition) return;
    clearConditionMutation.mutate({
      conditionId: clearingCondition.id,
      notes: clearanceNotes,
    });
  };

  const getNextStage = (current: string): string | null => {
    const idx = STAGE_ORDER.indexOf(current);
    if (idx >= 0 && idx < STAGE_ORDER.length - 1) {
      return STAGE_ORDER[idx + 1];
    }
    return null;
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
                  Pipeline Queue
                </h1>
                <p className="text-muted-foreground">
                  Manage active loans and clear conditions
                </p>
              </div>
              <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/pipeline/queue"] })} data-testid="button-refresh">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <Card data-testid="card-stat-total">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Active</p>
                      <p className="text-3xl font-bold" data-testid="text-total-loans">{queueData?.total || 0}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-200 dark:border-red-900" data-testid="card-stat-urgent">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Urgent</p>
                      <p className="text-3xl font-bold text-red-600" data-testid="text-urgent-count">{byPriority.urgent}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-orange-200 dark:border-orange-900" data-testid="card-stat-high">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">High Priority</p>
                      <p className="text-3xl font-bold text-orange-600" data-testid="text-high-count">{byPriority.high}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900">
                      <Clock className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-normal">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Normal</p>
                      <p className="text-3xl font-bold" data-testid="text-normal-count">{byPriority.normal}</p>
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                      <TrendingUp className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="card-stage-distribution">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Stage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-6">
                  {STAGE_ORDER.map((stage) => {
                    const count = byStage[stage]?.length || 0;
                    const isActive = count > 0;
                    return (
                      <button
                        key={stage}
                        onClick={() => setSelectedStage(stage === selectedStage ? "all" : stage)}
                        className={`flex flex-col items-center justify-center rounded-lg border p-3 transition-colors ${
                          selectedStage === stage 
                            ? "border-primary bg-primary/10" 
                            : isActive 
                              ? "border-border hover-elevate" 
                              : "border-border opacity-50"
                        }`}
                        data-testid={`button-stage-filter-${stage}`}
                      >
                        <span className="text-2xl font-bold">{count}</span>
                        <span className="text-xs text-muted-foreground text-center">
                          {formatStageLabel(stage)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-6">
              <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {selectedStage === "all" ? "All Active Loans" : formatStageLabel(selectedStage)}
                    <span className="ml-2 text-muted-foreground">({filteredQueue.length})</span>
                  </h2>
                  {selectedStage !== "all" && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedStage("all")} data-testid="button-clear-filter">
                      Clear filter
                    </Button>
                  )}
                </div>

                {filteredQueue.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <CheckCircle2 className="mb-4 h-12 w-12 text-muted-foreground" />
                      <p className="text-lg font-medium">No loans in queue</p>
                      <p className="text-muted-foreground">
                        {selectedStage === "all" 
                          ? "All loans have been processed" 
                          : `No loans in ${formatStageLabel(selectedStage)} stage`}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filteredQueue.map((item) => {
                      const nextStage = getNextStage(item.currentStage);
                      return (
                        <Card 
                          key={item.applicationId} 
                          className={`transition-colors ${
                            selectedApp === item.applicationId ? "ring-2 ring-primary" : ""
                          }`}
                          data-testid={`card-loan-${item.applicationId}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex flex-wrap items-start gap-4">
                              <div className={`mt-1 h-2 w-2 rounded-full ${getPriorityColor(item.priority)}`} />
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link href={`/pipeline/${item.applicationId}`}>
                                    <span className="font-medium hover:underline cursor-pointer" data-testid={`link-loan-${item.applicationId}`}>
                                      {item.borrowerName || `Loan #${item.applicationId.slice(0, 8)}`}
                                    </span>
                                  </Link>
                                  {getPriorityBadge(item.priority)}
                                  <Badge variant="outline">{formatStageLabel(item.currentStage)}</Badge>
                                </div>
                                
                                <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    {item.loanAmount ? formatCurrency(item.loanAmount) : "N/A"}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Timer className="h-3 w-3" />
                                    Day {item.daysInPipeline}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <ClipboardCheck className="h-3 w-3" />
                                    {item.conditionsCleared}/{item.conditionsTotal} conditions
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    {item.documentsReceived}/{item.documentsRequired} docs
                                  </span>
                                </div>

                                <div className="mt-3">
                                  <Progress value={item.completionPercentage} className="h-1.5" />
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {item.completionPercentage}% complete
                                  </p>
                                </div>
                              </div>

                              <div className="flex flex-col gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedApp(item.applicationId);
                                    setConditionDialogOpen(true);
                                  }}
                                  data-testid={`button-conditions-${item.applicationId}`}
                                >
                                  <ClipboardCheck className="mr-1 h-4 w-4" />
                                  Conditions
                                </Button>
                                {nextStage && (
                                  <Button 
                                    size="sm"
                                    disabled={item.completionPercentage < 100 || advanceStageMutation.isPending}
                                    onClick={() => advanceStageMutation.mutate({
                                      applicationId: item.applicationId,
                                      newStage: nextStage,
                                    })}
                                    data-testid={`button-advance-${item.applicationId}`}
                                  >
                                    <ArrowRight className="mr-1 h-4 w-4" />
                                    Advance
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={conditionDialogOpen} onOpenChange={setConditionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loan Conditions</DialogTitle>
            <DialogDescription>
              Review and clear conditions for this loan
            </DialogDescription>
          </DialogHeader>
          
          {conditionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : conditionData ? (
            <Tabs defaultValue="outstanding" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="outstanding" data-testid="tab-outstanding">
                  Outstanding ({conditionData.stats.outstanding})
                </TabsTrigger>
                <TabsTrigger value="submitted" data-testid="tab-submitted">
                  Submitted ({conditionData.stats.submitted})
                </TabsTrigger>
                <TabsTrigger value="cleared" data-testid="tab-cleared">
                  Cleared ({conditionData.stats.cleared})
                </TabsTrigger>
                <TabsTrigger value="waived" data-testid="tab-waived">
                  Waived ({conditionData.stats.waived})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="outstanding" className="mt-4 space-y-2">
                {conditionData.conditions
                  .filter(c => c.status === "outstanding")
                  .map(condition => (
                    <div key={condition.id} className="flex items-center justify-between rounded-lg border p-3" data-testid={`condition-${condition.id}`}>
                      <div>
                        <p className="font-medium">{condition.title}</p>
                        <p className="text-sm text-muted-foreground">{condition.description}</p>
                        <Badge variant="outline" className="mt-1">{condition.priority?.replace(/_/g, " ")}</Badge>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setClearingCondition(condition)}
                        data-testid={`button-clear-${condition.id}`}
                      >
                        <CheckCheck className="mr-1 h-4 w-4" />
                        Clear
                      </Button>
                    </div>
                  ))}
                {conditionData.conditions.filter(c => c.status === "outstanding").length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No outstanding conditions</p>
                )}
              </TabsContent>

              <TabsContent value="submitted" className="mt-4 space-y-2">
                {conditionData.conditions
                  .filter(c => c.status === "submitted")
                  .map(condition => (
                    <div key={condition.id} className="flex items-center justify-between rounded-lg border p-3" data-testid={`condition-${condition.id}`}>
                      <div>
                        <p className="font-medium">{condition.title}</p>
                        <p className="text-sm text-muted-foreground">{condition.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setClearingCondition(condition)}
                          data-testid={`button-clear-${condition.id}`}
                        >
                          <CheckCheck className="mr-1 h-4 w-4" />
                          Clear
                        </Button>
                      </div>
                    </div>
                  ))}
                {conditionData.conditions.filter(c => c.status === "submitted").length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No submitted conditions</p>
                )}
              </TabsContent>

              <TabsContent value="cleared" className="mt-4 space-y-2">
                {conditionData.conditions
                  .filter(c => c.status === "cleared")
                  .map(condition => (
                    <div key={condition.id} className="flex items-center gap-2 rounded-lg border p-3" data-testid={`condition-${condition.id}`}>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">{condition.title}</p>
                        {condition.clearanceNotes && (
                          <p className="text-sm text-muted-foreground">{condition.clearanceNotes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                {conditionData.conditions.filter(c => c.status === "cleared").length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No cleared conditions</p>
                )}
              </TabsContent>

              <TabsContent value="waived" className="mt-4 space-y-2">
                {conditionData.conditions
                  .filter(c => c.status === "waived")
                  .map(condition => (
                    <div key={condition.id} className="flex items-center gap-2 rounded-lg border p-3" data-testid={`condition-${condition.id}`}>
                      <XCircle className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium line-through">{condition.title}</p>
                        <p className="text-sm text-muted-foreground">Waived</p>
                      </div>
                    </div>
                  ))}
                {conditionData.conditions.filter(c => c.status === "waived").length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No waived conditions</p>
                )}
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!clearingCondition} onOpenChange={() => setClearingCondition(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear Condition</DialogTitle>
            <DialogDescription>
              Confirm clearing: {clearingCondition?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clearance-notes">Clearance Notes (optional)</Label>
              <Textarea
                id="clearance-notes"
                value={clearanceNotes}
                onChange={(e) => setClearanceNotes(e.target.value)}
                placeholder="Add any notes about why this condition is being cleared..."
                data-testid="input-clearance-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearingCondition(null)} data-testid="button-cancel-clear">
              Cancel
            </Button>
            <Button 
              onClick={handleClearCondition} 
              disabled={clearConditionMutation.isPending}
              data-testid="button-confirm-clear"
            >
              {clearConditionMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <CheckCheck className="mr-2 h-4 w-4" />
                  Clear Condition
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
