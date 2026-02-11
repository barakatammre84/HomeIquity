import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency, getStatusLabel } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BorrowerRequests } from "@/components/BorrowerRequests";
import { ApplicationSwitcher } from "@/components/ApplicationSwitcher";
import { JourneyTracker } from "@/components/JourneyTracker";
import { WhatsNext, FirstVisitWelcome } from "@/components/WhatsNext";
import { isStaffRole } from "@shared/schema";
import type { LoanApplication, DealActivity } from "@shared/schema";
import {
  CheckCircle2,
  Clock,
  FileText,
  ArrowRight,
  Lock,
  TrendingUp,
  Activity,
  Home,
  Percent,
  DollarSign,
  Calendar,
  User,
  Bot,
  Sparkles,
  Users,
  Download,
  Loader2,
} from "lucide-react";

interface DashboardData {
  applications: LoanApplication[];
  stats: {
    totalApplications: number;
    preApprovedAmount: string;
    pendingDocuments: number;
  };
  activities: DealActivity[];
  unreadMessages: number;
  pendingTaskCount: number;
}

function getConfidenceLabel(status: string): { label: string; color: string } {
  switch (status) {
    case "pre_approved":
      return { label: "Verified", color: "text-emerald-600 dark:text-emerald-400" };
    case "conditionally_approved":
      return { label: "Conditional", color: "text-amber-600 dark:text-amber-400" };
    case "under_review":
      return { label: "In Review", color: "text-blue-600 dark:text-blue-400" };
    default:
      return { label: "Pending", color: "text-muted-foreground" };
  }
}

function getExpirationDate(application: LoanApplication): string | null {
  if (application.status !== "pre_approved") return null;
  const createdDate = new Date(application.createdAt!);
  const expirationDate = new Date(createdDate);
  expirationDate.setDate(expirationDate.getDate() + 30);
  return expirationDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatActivityTime(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  const isStaff = isStaffRole(user?.role || "");

  useEffect(() => {
    if (!authLoading && isStaff) {
      navigate("/staff-dashboard");
    }
  }, [authLoading, isStaff, navigate]);

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: !authLoading && !isStaff,
  });

  if (authLoading || isLoading || isStaff) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const applications = data?.applications || [];
  const activities = data?.activities || [];
  const unreadMessages = data?.unreadMessages || 0;
  const pendingTaskCount = data?.pendingTaskCount || 0;

  const defaultApp = applications.find(
    (app) => !["closed", "denied"].includes(app.status)
  );
  
  const activeApplication = selectedAppId 
    ? applications.find(app => app.id === selectedAppId) || defaultApp
    : defaultApp;

  const isPreApproved = activeApplication?.status === "pre_approved";
  const expirationDate = activeApplication ? getExpirationDate(activeApplication) : null;
  const confidence = activeApplication ? getConfidenceLabel(activeApplication.status) : null;

  const hasOffers = isPreApproved;
  const offerCount = hasOffers ? 3 : 0;
  const rateRange = hasOffers ? "6.25% - 6.75%" : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 space-y-4">
        
        <div className="flex items-center justify-between gap-4 flex-wrap border-b pb-4">
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-dashboard-title">
              {user?.firstName ? `Hi, ${user.firstName}` : "Overview"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeApplication
                ? "Here's where things stand with your mortgage."
                : "Let's get you on the path to homeownership."}
            </p>
          </div>
          <ApplicationSwitcher
            applications={applications}
            activeApplicationId={activeApplication?.id}
            onSelectApplication={(app) => setSelectedAppId(app.id)}
          />
        </div>

        {activeApplication && activeApplication.status !== "draft" && (
          <Card data-testid="card-journey-tracker">
            <CardContent className="p-4 sm:p-6">
              <JourneyTracker status={activeApplication.status} />
            </CardContent>
          </Card>
        )}
        
        <Card 
          className="shadow-lg" 
          data-testid="card-approval-status"
        >
          <CardContent className="p-6">
            {activeApplication ? (
              <div className="flex items-start gap-4 flex-wrap">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 ${isPreApproved ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-primary/30 text-primary'}`}>
                  {isPreApproved ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <Clock className="h-6 w-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold" data-testid="text-approval-stage">
                      {isPreApproved ? "Pre-Approval Verified" : getStatusLabel(activeApplication.status)}
                    </h2>
                    {confidence && (
                      <Badge variant="outline" className={confidence.color} data-testid="badge-confidence">
                        {confidence.label}
                      </Badge>
                    )}
                  </div>
                  {expirationDate && (
                    <p className="text-sm text-muted-foreground mt-1" data-testid="text-expiration">
                      Valid until {expirationDate}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">No active application</p>
                <Link href="/apply">
                  <Button data-testid="button-start-application">
                    Start Your Application
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {activeApplication && (
          <BorrowerRequests 
            applicationId={activeApplication.id} 
            data-testid="card-what-we-need"
          />
        )}

        <WhatsNext
          application={activeApplication || null}
          pendingTasks={pendingTaskCount}
          pendingDocuments={data?.stats?.pendingDocuments || 0}
          unreadMessages={unreadMessages}
        />

        {activeApplication && (
          <Card className="shadow-md" data-testid="card-loan-snapshot">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                Your Loan Snapshot
                {isPreApproved && (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 p-3 border rounded-md">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                    <Home className="h-3.5 w-3.5" />
                    Max Purchase Price
                  </div>
                  <p className="text-lg font-semibold" data-testid="text-max-purchase">
                    {formatCurrency(activeApplication.preApprovalAmount || activeApplication.purchasePrice || "0")}
                  </p>
                </div>
                <div className="space-y-1 p-3 border rounded-md">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                    <Calendar className="h-3.5 w-3.5" />
                    Est. Payment
                  </div>
                  <p className="text-lg font-semibold" data-testid="text-est-payment">
                    {formatCurrency(
                      Math.round(
                        (Number(activeApplication.purchasePrice || 0) - Number(activeApplication.downPayment || 0)) * 0.006
                      ).toString()
                    )}/mo
                  </p>
                </div>
                <div className="space-y-1 p-3 border rounded-md">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                    <DollarSign className="h-3.5 w-3.5" />
                    Down Payment
                  </div>
                  <p className="text-lg font-semibold" data-testid="text-down-payment">
                    {formatCurrency(activeApplication.downPayment || "0")}
                  </p>
                </div>
                <div className="space-y-1 p-3 border rounded-md">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                    <Percent className="h-3.5 w-3.5" />
                    Loan Type
                  </div>
                  <p className="text-lg font-semibold" data-testid="text-loan-type">
                    Conventional
                  </p>
                </div>
              </div>
              {isPreApproved && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-4 flex-wrap">
                  <Lock className="h-3 w-3" />
                  Numbers locked from your pre-approval
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {hasOffers && activeApplication && (
          <Card className="shadow-md" data-testid="card-offers">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-500">
                    <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium" data-testid="text-offer-count">
                      {offerCount} Offers Available
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-rate-range">
                      Rates from {rateRange}
                    </p>
                  </div>
                </div>
                <Link href={`/pipeline/${activeApplication.id}/offers`}>
                  <Button variant="outline" size="sm" data-testid="button-compare-offers">
                    Compare
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {activeApplication && (
          <Card className="shadow-md" data-testid="card-hmda-compliance">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-blue-500">
                    <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium" data-testid="text-hmda-title">
                      Government Monitoring
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Required demographic information (HMDA)
                    </p>
                  </div>
                </div>
                <Link href={`/hmda/${activeApplication.id}`}>
                  <Button variant="outline" size="sm" data-testid="button-complete-hmda">
                    Complete
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {activeApplication && ["submitted", "analyzing"].includes(activeApplication.status) && (
          <PreQualLetterCard applicationId={activeApplication.id} />
        )}

        {activities.length > 0 && (
          <Card className="shadow-md" data-testid="card-recent-activity">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                <Activity className="h-4 w-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="divide-y">
                {activities.slice(0, 5).map((activity, index) => (
                  <div key={activity.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 flex-wrap" data-testid={`row-activity-${index}`}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border">
                      {!activity.performedBy ? (
                        <Bot className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" data-testid={`text-activity-desc-${index}`}>
                        {activity.description || activity.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground" data-testid={`text-activity-time-${index}`}>
                          {formatActivityTime(activity.createdAt!)}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground" data-testid={`text-activity-actor-${index}`}>
                          {!activity.performedBy ? "System" : "Team"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!activeApplication && (
          <FirstVisitWelcome
            userName={user?.firstName || undefined}
            hasApplication={applications.length > 0}
            hasDocuments={(data?.stats?.pendingDocuments || 0) > 0 || applications.some(a => a.status !== "draft")}
          />
        )}

        {activeApplication && (
          <Card className="hover-elevate" data-testid="card-ai-coach-cta">
            <CardContent className="flex items-center gap-4 py-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">AI Homebuyer Coach</h3>
                <p className="text-sm text-muted-foreground">
                  Get personalized guidance on your mortgage readiness, documents you'll need, and steps to strengthen your application.
                </p>
              </div>
              <Link href="/ai-coach">
                <Button variant="outline" data-testid="button-open-ai-coach">
                  Start Chat
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

function PreQualLetterCard({ applicationId }: { applicationId: string }) {
  const { toast } = useToast();

  const statusQuery = useQuery<{ hasLetter: boolean; letterNumber?: string; estimatedAmount?: string }>({
    queryKey: ["/api/loan-applications", applicationId, "prequal-status"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/generate-prequal`);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Letter Ready", description: `Your pre-qualification letter #${data.letterNumber} has been generated.` });
      queryClient.invalidateQueries({ queryKey: ["/api/loan-applications", applicationId, "prequal-status"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not generate letter. Please try again.", variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/loan-applications/${applicationId}/prequal-pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pre-qualification-letter.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Could not download letter.", variant: "destructive" });
    }
  };

  const hasLetter = statusQuery.data?.hasLetter;

  return (
    <Card className="shadow-md" data-testid="card-prequal-letter">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-amber-500">
              <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-medium" data-testid="text-prequal-title">
                Pre-Qualification Letter
              </p>
              <p className="text-sm text-muted-foreground">
                {hasLetter
                  ? "Your letter is ready to download"
                  : "Get a preliminary qualification letter based on your application"}
              </p>
            </div>
          </div>
          {hasLetter ? (
            <Button onClick={handleDownload} variant="outline" size="sm" className="gap-2" data-testid="button-download-prequal-dash">
              <Download className="h-4 w-4" />
              Download
            </Button>
          ) : (
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              variant="outline"
              size="sm"
              className="gap-2"
              data-testid="button-generate-prequal-dash"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {generateMutation.isPending ? "Generating..." : "Generate"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
