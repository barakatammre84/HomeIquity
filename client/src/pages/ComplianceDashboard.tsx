import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import {
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield,
  FileCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Users,
  Building2,
  BarChart3,
  Archive,
  Database,
  Bell,
  RefreshCw,
} from "lucide-react";
import type { LoanApplication } from "@shared/schema";

interface PipelineSummary {
  applicationId: string;
  borrowerName: string;
  currentStage: string;
  priority: "urgent" | "high" | "normal";
  daysInPipeline: number;
  completionPercentage: number;
  documentsRequired: number;
  documentsReceived: number;
  conditionsTotal: number;
  conditionsCleared: number;
  lastActivityAt: Date;
  loanAmount?: number;
  loanType?: string;
}

interface ValidationSummary {
  applicationId: string;
  borrowerName: string;
  status: string;
  loanAmount: number | null;
  score: number;
  gseReady: boolean;
  ulddCompliant: boolean;
  criticalCount: number;
  warningCount: number;
  missingDocsCount: number;
  sections: {
    name: string;
    number: string;
    score: number;
    complete: boolean;
  }[];
}

interface ComplianceData {
  total: number;
  gseReady: number;
  ulddCompliant: number;
  needsAttention: number;
  applications: ValidationSummary[];
}

interface RetentionPolicy {
  dataType: string;
  retentionPeriodDays: number;
  archiveAfterDays: number;
  deleteAfterDays: number | null;
  legalBasis: string;
  regulatoryReference: string;
}

interface RetentionReport {
  generatedAt: string;
  policies: RetentionPolicy[];
  recordCounts: Record<string, number>;
  archiveEligibleCounts: Record<string, number>;
  deleteEligibleCounts: Record<string, number>;
  retentionReviewCounts: Record<string, number>;
  recommendations: string[];
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number | string | null | undefined): string {
  if (!amount) return "$0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export default function ComplianceDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const isStaff = ["admin", "lender", "broker"].includes(user?.role || "");

  const { data: queueResponse, isLoading: queueLoading } = useQuery<{ queue: PipelineSummary[] }>({
    queryKey: ["/api/pipeline/queue"],
    enabled: isStaff && !authLoading,
  });

  const { data: complianceData, isLoading: complianceLoading } = useQuery<ComplianceData>({
    queryKey: ["/api/compliance/dashboard"],
    enabled: isStaff && !authLoading,
  });

  const { data: retentionReport, isLoading: retentionLoading, refetch: refetchRetention } = useQuery<RetentionReport>({
    queryKey: ["/api/credit/retention-report"],
    enabled: isStaff && !authLoading,
  });

  const { data: retentionPoliciesData } = useQuery<{ policies: Record<string, RetentionPolicy> }>({
    queryKey: ["/api/credit/retention-policies"],
    enabled: isStaff && !authLoading,
  });

  const isLoading = authLoading || queueLoading || complianceLoading;

  if (!isStaff) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              Only staff members can access the compliance dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const queue = queueResponse?.queue || [];
  const validationApps = complianceData?.applications || [];
  const urgentLoans = queue.filter(l => l.priority === "urgent");
  const pendingDisclosures = queue.filter(l => l.currentStage === "pre_approval" || l.currentStage === "application");
  const awaitingDocs = queue.filter(l => l.documentsReceived < l.documentsRequired);
  const readyToClose = queue.filter(l => l.currentStage === "clear_to_close");

  const totalVolume = queue.reduce((sum, l) => sum + (l.loanAmount || 0), 0);
  const avgDaysInPipeline = queue.length > 0 
    ? Math.round(queue.reduce((sum, l) => sum + l.daysInPipeline, 0) / queue.length)
    : 0;

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-3">
        <div className="flex items-center gap-4">
          <SidebarTrigger data-testid="button-sidebar-toggle" />
          <div>
            <h1 className="text-xl font-semibold">Compliance Dashboard</h1>
            <p className="text-sm text-muted-foreground">TRID, MISMO & Regulatory Tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" data-testid="button-export-report">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </header>

      <div className="p-6">
            <div className="mx-auto max-w-6xl space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-active-loans">
                      {queue.length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(totalVolume)} total volume
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Urgent Items</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600" data-testid="text-urgent-count">
                      {urgentLoans.length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Require immediate attention
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Days in Pipeline</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-avg-days">
                      {avgDaysInPipeline}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Target: 21 days
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ready to Close</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600" data-testid="text-ready-close">
                      {readyToClose.length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Clear to close
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="trid" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="trid" data-testid="tab-trid">
                    <Calendar className="mr-2 h-4 w-4" />
                    TRID Timing
                  </TabsTrigger>
                  <TabsTrigger value="mismo" data-testid="tab-mismo">
                    <FileCheck className="mr-2 h-4 w-4" />
                    MISMO Validation
                  </TabsTrigger>
                  <TabsTrigger value="retention" data-testid="tab-retention">
                    <Archive className="mr-2 h-4 w-4" />
                    Data Retention
                  </TabsTrigger>
                  <TabsTrigger value="audit" data-testid="tab-audit">
                    <Shield className="mr-2 h-4 w-4" />
                    Audit Log
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="trid" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-amber-500" />
                          Disclosure Deadlines
                        </CardTitle>
                        <CardDescription>
                          Loans requiring LE/CD within TRID timelines
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[300px]">
                          {pendingDisclosures.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                              All disclosures are current
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {pendingDisclosures.map((loan) => (
                                <div
                                  key={loan.applicationId}
                                  className="flex items-center justify-between rounded-lg border p-3"
                                >
                                  <div>
                                    <p className="font-medium">{loan.borrowerName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      Stage: {loan.currentStage.replace(/_/g, " ")}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant={loan.daysInPipeline > 2 ? "destructive" : "secondary"}>
                                      Day {loan.daysInPipeline}
                                    </Badge>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      LE due in {Math.max(0, 3 - loan.daysInPipeline)} days
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          TRID Compliance Rules
                        </CardTitle>
                        <CardDescription>
                          Key timing requirements
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-start gap-3 rounded-lg border p-3">
                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                            <div>
                              <p className="font-medium">Loan Estimate (LE)</p>
                              <p className="text-sm text-muted-foreground">
                                Must be provided within 3 business days of application
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 rounded-lg border p-3">
                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                            <div>
                              <p className="font-medium">Closing Disclosure (CD)</p>
                              <p className="text-sm text-muted-foreground">
                                Must be provided 3 business days before closing
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 rounded-lg border p-3">
                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                            <div>
                              <p className="font-medium">Changed Circumstances</p>
                              <p className="text-sm text-muted-foreground">
                                Revised LE within 3 business days of change
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="mismo" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3 mb-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">GSE Ready</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600" data-testid="text-gse-ready">
                          {complianceData?.gseReady || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Ready for Fannie/Freddie submission
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">ULDD Compliant</CardTitle>
                        <FileCheck className="h-4 w-4 text-blue-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-600" data-testid="text-uldd-compliant">
                          {complianceData?.ulddCompliant || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Meet minimum data requirements
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-amber-600" data-testid="text-needs-attention">
                          {complianceData?.needsAttention || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Missing critical data
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileCheck className="h-5 w-5" />
                        MISMO 3.4 / ULAD Validation Status
                      </CardTitle>
                      <CardDescription>
                        Data completeness for GSE submission
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        {validationApps.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            No active loans to validate
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {validationApps.map((app) => (
                              <div
                                key={app.applicationId}
                                className="rounded-lg border p-4"
                                data-testid={`card-validation-${app.applicationId}`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div>
                                    <p className="font-medium">{app.borrowerName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {app.status?.toUpperCase().replace(/_/g, " ")} • {formatCurrency(app.loanAmount)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {app.gseReady ? (
                                      <Badge data-testid={`badge-gse-ready-${app.applicationId}`}>
                                        GSE Ready
                                      </Badge>
                                    ) : app.ulddCompliant ? (
                                      <Badge variant="secondary" data-testid={`badge-uldd-compliant-${app.applicationId}`}>
                                        ULDD Compliant
                                      </Badge>
                                    ) : (
                                      <Badge variant="destructive" data-testid={`badge-incomplete-${app.applicationId}`}>
                                        Incomplete
                                      </Badge>
                                    )}
                                    <Button size="sm" variant="outline" asChild data-testid={`button-view-${app.applicationId}`}>
                                      <Link href={`/borrower-file/${app.applicationId}`}>
                                        View
                                      </Link>
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between text-xs">
                                    <span>ULAD Completeness</span>
                                    <span>{app.score}%</span>
                                  </div>
                                  <Progress value={app.score} className="h-2" />
                                </div>
                                <div className="mt-3 grid grid-cols-4 gap-2">
                                  {app.sections.map((section) => (
                                    <div 
                                      key={section.number}
                                      className={`rounded p-2 text-center text-xs ${
                                        section.complete 
                                          ? "bg-green-500/10 text-green-700 dark:text-green-400" 
                                          : "bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      <div className="font-medium">§{section.number}</div>
                                      <div>{section.score}%</div>
                                    </div>
                                  ))}
                                </div>
                                {(app.criticalCount > 0 || app.missingDocsCount > 0) && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {app.criticalCount > 0 && (
                                      <Badge variant="outline" className="text-xs text-destructive">
                                        {app.criticalCount} critical errors
                                      </Badge>
                                    )}
                                    {app.missingDocsCount > 0 && (
                                      <Badge variant="outline" className="text-xs">
                                        {app.missingDocsCount} missing docs
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="retention" className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="text-lg font-semibold">Data Retention & Archival</h2>
                      <p className="text-sm text-muted-foreground">
                        FCRA, ECOA, and GLBA compliance tracking
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => refetchRetention()}
                      data-testid="button-refresh-retention"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>

                  {retentionLoading ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-4 mb-4">
                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                            <Database className="h-4 w-4 text-muted-foreground" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold" data-testid="text-total-records">
                              {Object.values(retentionReport?.recordCounts || {}).reduce((a, b) => a + b, 0)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Across all data types
                            </p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Archive Eligible</CardTitle>
                            <Archive className="h-4 w-4 text-amber-500" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-amber-600" data-testid="text-archive-eligible">
                              {Object.values(retentionReport?.archiveEligibleCounts || {}).reduce((a, b) => a + b, 0)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Ready for archival
                            </p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Retention Review</CardTitle>
                            <Clock className="h-4 w-4 text-blue-500" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-blue-600" data-testid="text-retention-review">
                              {Object.values(retentionReport?.retentionReviewCounts || {}).reduce((a, b) => a + b, 0)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Approaching retention end
                            </p>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Delete Eligible</CardTitle>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold text-red-600" data-testid="text-delete-eligible">
                              {Object.values(retentionReport?.deleteEligibleCounts || {}).reduce((a, b) => a + b, 0)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Past retention period
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="grid gap-4 md:grid-cols-1 mb-4">
                        <Card>
                          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Overall Compliance Status</CardTitle>
                            {Object.values(retentionReport?.deleteEligibleCounts || {}).reduce((a, b) => a + b, 0) === 0 &&
                             Object.values(retentionReport?.retentionReviewCounts || {}).reduce((a, b) => a + b, 0) === 0 ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : Object.values(retentionReport?.deleteEligibleCounts || {}).reduce((a, b) => a + b, 0) > 0 ? (
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Bell className="h-4 w-4 text-amber-500" />
                            )}
                          </CardHeader>
                          <CardContent>
                            <div 
                              className={`text-2xl font-bold ${
                                Object.values(retentionReport?.deleteEligibleCounts || {}).reduce((a, b) => a + b, 0) > 0
                                  ? "text-red-600"
                                  : Object.values(retentionReport?.retentionReviewCounts || {}).reduce((a, b) => a + b, 0) > 0
                                    ? "text-amber-600"
                                    : "text-green-600"
                              }`}
                              data-testid="text-compliance-status"
                            >
                              {Object.values(retentionReport?.deleteEligibleCounts || {}).reduce((a, b) => a + b, 0) > 0
                                ? "Action Required"
                                : Object.values(retentionReport?.retentionReviewCounts || {}).reduce((a, b) => a + b, 0) > 0
                                  ? "Review Needed"
                                  : "Compliant"}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              FCRA, ECOA, GLBA retention requirements
                            </p>
                          </CardContent>
                        </Card>
                      </div>

                      {retentionReport?.recommendations && retentionReport.recommendations.length > 0 && (
                        <Card className="mb-4">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Bell className="h-5 w-5 text-amber-500" />
                              Recommendations & Alerts
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              {retentionReport.recommendations.map((rec, idx) => (
                                <div 
                                  key={idx} 
                                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                                  data-testid={`alert-recommendation-${idx}`}
                                >
                                  {rec.includes("No action") ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                                  ) : (
                                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                                  )}
                                  <span className="text-sm">{rec}</span>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <Database className="h-5 w-5" />
                              Record Counts by Type
                            </CardTitle>
                            <CardDescription>
                              Current data inventory
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {Object.entries(retentionReport?.recordCounts || {}).map(([type, count]) => (
                                <div 
                                  key={type}
                                  className="flex items-center justify-between p-3 rounded-lg border"
                                  data-testid={`row-record-${type}`}
                                >
                                  <div>
                                    <p className="font-medium capitalize">{type.replace(/_/g, " ")}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {retentionPoliciesData?.policies?.[type]?.regulatoryReference || "N/A"}
                                    </p>
                                  </div>
                                  <Badge variant="secondary">{count}</Badge>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                              <FileText className="h-5 w-5" />
                              Retention Policies
                            </CardTitle>
                            <CardDescription>
                              Regulatory retention requirements
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ScrollArea className="h-[300px]">
                              <div className="space-y-3">
                                {Object.entries(retentionPoliciesData?.policies || {}).map(([type, policy]) => (
                                  <div 
                                    key={type}
                                    className="p-3 rounded-lg border"
                                    data-testid={`row-policy-${type}`}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="font-medium capitalize">{type.replace(/_/g, " ")}</p>
                                      <Badge variant="outline">
                                        {Math.round(policy.retentionPeriodDays / 365)} years
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground mb-1">
                                      {policy.legalBasis}
                                    </p>
                                    <div className="flex gap-2 text-xs">
                                      <span className="text-muted-foreground">
                                        Archive: {policy.archiveAfterDays} days
                                      </span>
                                      <span className="text-muted-foreground">
                                        Delete: {policy.deleteAfterDays ? `${policy.deleteAfterDays} days` : "Never"}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="audit" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Compliance Audit Log
                      </CardTitle>
                      <CardDescription>
                        Track all compliance-related activities with cryptographic verification
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-3 mb-6">
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-5 w-5 text-green-500" />
                            <span className="font-medium">Hash Chain Verified</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            All audit entries are cryptographically linked
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 mb-2">
                            <FileCheck className="h-5 w-5 text-blue-500" />
                            <span className="font-medium">Export Ready</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            CSV and JSON formats for regulatory exams
                          </p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-5 w-5 text-amber-500" />
                            <span className="font-medium">7-Year Retention</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            FCRA compliant data retention
                          </p>
                        </div>
                      </div>
                      <div className="text-center text-muted-foreground py-8">
                        <p className="text-sm">
                          Access individual loan audit logs from the Borrower File page.
                        </p>
                        <Button variant="outline" className="mt-4" asChild>
                          <Link href="/pipeline-queue">
                            View Loan Pipeline
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
    </>
  );
}
