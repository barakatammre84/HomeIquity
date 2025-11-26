import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  User,
  DollarSign,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  Download,
  MessageSquare,
  Calendar,
  ArrowLeft,
  Briefcase,
  CreditCard,
  Home,
  Shield,
} from "lucide-react";
import type { LoanApplication, Document, LoanCondition, UrlaPersonalInfo } from "@shared/schema";

interface ApplicationData {
  application: LoanApplication;
  options: any[];
  documents: Document[];
  activities: any[];
}

interface PersonalInfoData {
  personalInfo: UrlaPersonalInfo | null;
}

interface PipelineData {
  progress: {
    completionPercentage: number;
    documentsReceived: number;
    documentsRequired: number;
    conditionsCleared: number;
    conditionsTotal: number;
    readyForNextStage: boolean;
    blockers: string[];
    nextSteps: string[];
  };
  summary: any;
  milestones: Record<string, Date | null>;
  conditions: LoanCondition[];
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

export default function BorrowerFile() {
  const params = useParams();
  const applicationId = params.id as string;
  const { user, isLoading: authLoading } = useAuth();

  const { data: appData, isLoading: appLoading } = useQuery<ApplicationData>({
    queryKey: [`/api/loan-applications/${applicationId}`],
    enabled: !!applicationId && !authLoading,
  });

  const { data: pipelineData, isLoading: pipelineLoading } = useQuery<PipelineData>({
    queryKey: [`/api/loan-applications/${applicationId}/pipeline`],
    enabled: !!applicationId && !authLoading,
  });

  const { data: urlaData } = useQuery<{ personalInfo: UrlaPersonalInfo | null }>({
    queryKey: [`/api/urla/${applicationId}`],
    enabled: !!applicationId && !authLoading,
  });

  const isLoading = authLoading || appLoading || pipelineLoading;

  if (isLoading) {
    return (
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-6xl space-y-6">
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

  const application = appData?.application;
  const documents = appData?.documents || [];
  const activities = appData?.activities || [];
  const conditions = pipelineData?.conditions || [];
  const progress = pipelineData?.progress;
  const personalInfo = urlaData?.personalInfo;

  if (!application) {
    return (
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex-1 flex items-center justify-center">
            <Card className="max-w-md">
              <CardHeader>
                <CardTitle>File Not Found</CardTitle>
                <CardDescription>
                  This borrower file could not be found.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/pipeline-queue">Back to Pipeline</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  const outstandingConditions = conditions.filter(c => c.status === "outstanding");
  const clearedConditions = conditions.filter(c => c.status === "cleared");

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-y-auto">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-3">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <Button variant="ghost" size="sm" asChild>
                <Link href="/pipeline-queue">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Pipeline Queue
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" data-testid="button-export-mismo">
                <Download className="mr-2 h-4 w-4" />
                Export MISMO
              </Button>
              <Button size="sm" data-testid="button-generate-le">
                <FileText className="mr-2 h-4 w-4" />
                Generate LE
              </Button>
            </div>
          </header>

          <div className="p-6">
            <div className="mx-auto max-w-6xl space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold" data-testid="text-borrower-name">
                    {personalInfo?.firstName || "Borrower"} {personalInfo?.lastName || ""}
                  </h1>
                  <p className="text-muted-foreground">
                    Loan #{application.id.substring(0, 8).toUpperCase()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={application.status === "pre_approved" ? "default" : "secondary"}>
                    {application.status?.replace(/_/g, " ").toUpperCase()}
                  </Badge>
                  <Badge variant="outline">
                    {application.preferredLoanType?.toUpperCase() || "CONVENTIONAL"}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Loan Amount</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-loan-amount">
                      {formatCurrency(
                        application.purchasePrice && application.downPayment
                          ? Number(application.purchasePrice) - Number(application.downPayment)
                          : application.purchasePrice
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {application.loanPurpose === "purchase" ? "Purchase" : "Refinance"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Credit Score</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-credit-score">
                      {application.creditScore || "---"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {application.creditScore && application.creditScore >= 740 ? "Excellent" :
                       application.creditScore && application.creditScore >= 680 ? "Good" :
                       application.creditScore && application.creditScore >= 620 ? "Fair" : "Pending"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Documents</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-doc-count">
                      {progress?.documentsReceived || 0}/{progress?.documentsRequired || 0}
                    </div>
                    <Progress 
                      value={progress?.documentsRequired ? (progress.documentsReceived / progress.documentsRequired) * 100 : 0} 
                      className="mt-2 h-2" 
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Conditions</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-condition-count">
                      {progress?.conditionsCleared || 0}/{progress?.conditionsTotal || 0}
                    </div>
                    <Progress 
                      value={progress?.conditionsTotal ? (progress.conditionsCleared / progress.conditionsTotal) * 100 : 0} 
                      className="mt-2 h-2" 
                    />
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="overview" data-testid="tab-overview">
                    <User className="mr-2 h-4 w-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="documents" data-testid="tab-documents">
                    <FileText className="mr-2 h-4 w-4" />
                    Documents
                  </TabsTrigger>
                  <TabsTrigger value="conditions" data-testid="tab-conditions">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Conditions
                  </TabsTrigger>
                  <TabsTrigger value="timeline" data-testid="tab-timeline">
                    <Clock className="mr-2 h-4 w-4" />
                    Timeline
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          Borrower Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <span className="text-muted-foreground">Name:</span>
                          <span>{personalInfo?.firstName || "N/A"} {personalInfo?.lastName || ""}</span>
                          <span className="text-muted-foreground">Email:</span>
                          <span>{personalInfo?.email || "N/A"}</span>
                          <span className="text-muted-foreground">Phone:</span>
                          <span>{personalInfo?.cellPhone || personalInfo?.homePhone || "N/A"}</span>
                          <span className="text-muted-foreground">SSN:</span>
                          <span>XXX-XX-{personalInfo?.ssn?.slice(-4) || "XXXX"}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Briefcase className="h-5 w-5" />
                          Employment
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <span className="text-muted-foreground">Type:</span>
                          <span className="capitalize">{application.employmentType || "N/A"}</span>
                          <span className="text-muted-foreground">Employer:</span>
                          <span>{application.employerName || "N/A"}</span>
                          <span className="text-muted-foreground">Years:</span>
                          <span>{application.employmentYears || 0} years</span>
                          <span className="text-muted-foreground">Income:</span>
                          <span>{formatCurrency(application.annualIncome)}/year</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Home className="h-5 w-5" />
                          Property
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <span className="text-muted-foreground">Address:</span>
                          <span>{application.propertyAddress || "N/A"}</span>
                          <span className="text-muted-foreground">City/State:</span>
                          <span>{application.propertyCity}, {application.propertyState}</span>
                          <span className="text-muted-foreground">Value:</span>
                          <span>{formatCurrency(application.propertyValue)}</span>
                          <span className="text-muted-foreground">Type:</span>
                          <span className="capitalize">{application.propertyType || "SFR"}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          Loan Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <span className="text-muted-foreground">Purpose:</span>
                          <span className="capitalize">{application.loanPurpose || "Purchase"}</span>
                          <span className="text-muted-foreground">Down Payment:</span>
                          <span>{formatCurrency(application.downPayment)}</span>
                          <span className="text-muted-foreground">LTV:</span>
                          <span>{application.ltvRatio ? `${(Number(application.ltvRatio) * 100).toFixed(1)}%` : "N/A"}</span>
                          <span className="text-muted-foreground">DTI:</span>
                          <span>{application.dtiRatio ? `${(Number(application.dtiRatio) * 100).toFixed(1)}%` : "N/A"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Uploaded Documents</CardTitle>
                        <Button size="sm" data-testid="button-request-docs">
                          <Upload className="mr-2 h-4 w-4" />
                          Request Documents
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {documents.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          No documents uploaded yet.
                        </p>
                      ) : (
                        <ScrollArea className="h-[400px]">
                          <div className="space-y-2">
                            {documents.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between rounded-lg border p-3"
                              >
                                <div className="flex items-center gap-3">
                                  <FileText className="h-5 w-5 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">{doc.fileName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {doc.documentType} • {formatDate(doc.createdAt)}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant={
                                  doc.status === "verified" ? "default" :
                                  doc.status === "rejected" ? "destructive" : "secondary"
                                }>
                                  {doc.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="conditions" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-amber-500" />
                          Outstanding ({outstandingConditions.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[300px]">
                          {outstandingConditions.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">
                              No outstanding conditions
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {outstandingConditions.map((cond) => (
                                <div
                                  key={cond.id}
                                  className="rounded-lg border p-3"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="font-medium">{cond.title}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {cond.category} • {cond.priority?.replace(/_/g, " ")}
                                      </p>
                                    </div>
                                    <Button size="sm" variant="outline">
                                      Clear
                                    </Button>
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
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          Cleared ({clearedConditions.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[300px]">
                          {clearedConditions.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">
                              No cleared conditions yet
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {clearedConditions.map((cond) => (
                                <div
                                  key={cond.id}
                                  className="rounded-lg border border-green-500/20 bg-green-500/5 p-3"
                                >
                                  <p className="font-medium">{cond.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Cleared {formatDate(cond.clearedAt)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Activity Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        {activities.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            No activity recorded yet.
                          </p>
                        ) : (
                          <div className="space-y-4">
                            {activities.map((activity: any, index: number) => (
                              <div
                                key={activity.id || index}
                                className="relative flex gap-4 pb-4 last:pb-0"
                              >
                                <div className="flex flex-col items-center">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                    {activity.activityType === "status_change" ? (
                                      <Shield className="h-4 w-4 text-primary" />
                                    ) : activity.activityType === "document_uploaded" ? (
                                      <Upload className="h-4 w-4 text-primary" />
                                    ) : (
                                      <MessageSquare className="h-4 w-4 text-primary" />
                                    )}
                                  </div>
                                  {index < activities.length - 1 && (
                                    <div className="flex-1 w-px bg-border" />
                                  )}
                                </div>
                                <div className="flex-1 pt-1">
                                  <p className="font-medium">{activity.title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {activity.description}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {formatDate(activity.createdAt)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
