import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, getStatusLabel, getStatusColor } from "@/lib/authUtils";
import type { LoanApplication, LoanOption, Document } from "@shared/schema";
import {
  FileText,
  Upload,
  Clock,
  CheckCircle2,
  AlertCircle,
  Home,
  DollarSign,
  TrendingUp,
  Plus,
  ArrowRight,
  FileCheck,
  Building2,
} from "lucide-react";

interface DashboardData {
  applications: LoanApplication[];
  recentOptions: LoanOption[];
  documents: Document[];
  stats: {
    totalApplications: number;
    preApprovedAmount: string;
    pendingDocuments: number;
  };
}

const statusSteps = [
  { status: "submitted", label: "Application", icon: FileText },
  { status: "analyzing", label: "Analysis", icon: TrendingUp },
  { status: "pre_approved", label: "Pre-Approved", icon: CheckCircle2 },
  { status: "underwriting", label: "Underwriting", icon: FileCheck },
  { status: "approved", label: "Approved", icon: Home },
];

function getStepProgress(status: string): number {
  const statusOrder = ["draft", "submitted", "analyzing", "pre_approved", "verified", "underwriting", "approved", "closed"];
  const currentIndex = statusOrder.indexOf(status);
  return Math.max(0, ((currentIndex + 1) / statusOrder.length) * 100);
}

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: !authLoading,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="mb-8 h-8 w-48" />
          <div className="grid gap-6 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="mt-8 h-64" />
        </div>
      </div>
    );
  }

  const applications = data?.applications || [];
  const documents = data?.documents || [];
  const stats = data?.stats || {
    totalApplications: 0,
    preApprovedAmount: "0",
    pendingDocuments: 0,
  };

  const activeApplication = applications.find(
    (app) => !["closed", "denied"].includes(app.status)
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Track your loan applications and manage your documents
            </p>
          </div>
          <Link href="/apply">
            <Button className="gap-2" data-testid="button-new-application">
              <Plus className="h-4 w-4" />
              New Application
            </Button>
          </Link>
        </div>

        <div className="mb-8 grid gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Applications</p>
                <p className="text-2xl font-bold" data-testid="text-total-applications">
                  {stats.totalApplications}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pre-Approved</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-preapproved-amount">
                  {formatCurrency(stats.preApprovedAmount)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Upload className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Documents</p>
                <p className="text-2xl font-bold" data-testid="text-pending-documents">
                  {stats.pendingDocuments}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {activeApplication && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Current Application</CardTitle>
                  <CardDescription>
                    Started {new Date(activeApplication.createdAt!).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(activeApplication.status)}>
                  {getStatusLabel(activeApplication.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{Math.round(getStepProgress(activeApplication.status))}%</span>
                </div>
                <Progress value={getStepProgress(activeApplication.status)} className="h-2" />
              </div>

              <div className="flex justify-between">
                {statusSteps.map((step, index) => {
                  const stepStatuses = ["submitted", "analyzing", "pre_approved", "underwriting", "approved"];
                  const currentIndex = stepStatuses.indexOf(activeApplication.status);
                  const stepIndex = stepStatuses.indexOf(step.status);
                  const isCompleted = stepIndex <= currentIndex;
                  const isCurrent = step.status === activeApplication.status;

                  return (
                    <div
                      key={step.status}
                      className={`flex flex-col items-center ${
                        isCompleted ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${
                          isCurrent
                            ? "bg-primary text-primary-foreground"
                            : isCompleted
                            ? "bg-primary/20"
                            : "bg-muted"
                        }`}
                      >
                        {isCompleted && !isCurrent ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <step.icon className="h-5 w-5" />
                        )}
                      </div>
                      <span className="mt-2 text-xs font-medium">{step.label}</span>
                    </div>
                  );
                })}
              </div>

              {activeApplication.status === "pre_approved" && (
                <div className="mt-6 flex items-center justify-between rounded-lg border bg-green-50 p-4 dark:bg-green-900/20">
                  <div>
                    <p className="font-medium text-green-700 dark:text-green-300">
                      You're pre-approved for {formatCurrency(activeApplication.preApprovalAmount || activeApplication.purchasePrice || "0")}
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      View your loan options and lock in your rate
                    </p>
                  </div>
                  <Link href={`/loan-options/${activeApplication.id}`}>
                    <Button size="sm" className="gap-2">
                      View Options
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Recent Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <div className="py-8 text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">No applications yet</p>
                  <Link href="/apply">
                    <Button className="mt-4" variant="outline">
                      Start Your Application
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {applications.slice(0, 5).map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <Home className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {formatCurrency(app.purchasePrice || "0")} Purchase
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(app.createdAt!).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(app.status)}>
                        {getStatusLabel(app.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Documents
                </CardTitle>
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Upload
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="py-8 text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-4 text-muted-foreground">No documents uploaded</p>
                  <p className="text-sm text-muted-foreground">
                    Upload pay stubs, tax returns, and bank statements
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents.slice(0, 5).map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <FileCheck className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{doc.fileName}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {doc.documentType.replace("_", " ")}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={doc.status === "verified" ? "default" : "secondary"}
                      >
                        {doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Browse Properties</p>
                <p className="text-sm text-muted-foreground">
                  Find your dream home with instant loan options
                </p>
              </div>
            </div>
            <Link href="/properties">
              <Button variant="outline" className="gap-2">
                Browse MLS
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
