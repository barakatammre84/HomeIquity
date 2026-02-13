import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePageView, useTrackActivity } from "@/hooks/useActivityTracker";
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
import { WhatsNext, FirstVisitWelcome, getNextActions } from "@/components/WhatsNext";
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
  Search,
  Calculator,
  MessageSquare,
  AlertTriangle,
  AlertCircle,
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
  loanOptionCounts?: Record<string, number>;
  hmdaStatus?: Record<string, boolean>;
  recentOptions?: Array<{ id: string; applicationId: string; interestRate: string; loanType: string; programName: string }>;
  verificationStatus?: Record<string, { hasCreditConsent: boolean; hasIdVerification: boolean; hasBankConnected: boolean; hasRateLocked: boolean }>;
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

function getExpirationInfo(application: LoanApplication): { label: string; daysLeft: number; urgency: "expired" | "urgent" | "normal" } | null {
  if (application.status !== "pre_approved") return null;
  if (!application.createdAt) return null;
  const createdDate = new Date(application.createdAt);
  if (isNaN(createdDate.getTime())) return null;
  const expirationDate = new Date(createdDate);
  expirationDate.setDate(expirationDate.getDate() + 30);
  const now = new Date();
  const daysLeft = Math.ceil((expirationDate.getTime() - now.getTime()) / 86400000);
  const label = expirationDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const urgency = daysLeft <= 0 ? "expired" : daysLeft <= 7 ? "urgent" : "normal";
  return { label, daysLeft, urgency };
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

interface NudgeItem {
  id: string;
  icon: any;
  title: string;
  description: string;
  action: string;
  href: string;
  priority: number;
}

function PersonalizedNudges({ application, expirationInfo, whatsNextHrefs = [] }: { application: LoanApplication | null; expirationInfo: { label: string; daysLeft: number; urgency: "expired" | "urgent" | "normal" } | null; whatsNextHrefs?: string[] }) {
  const { data: activitySummary } = useQuery<{
    totalPageViews: number;
    propertySearches: number;
    calculatorUses: number;
    coachChats: number;
    propertyViews: number;
  }>({
    queryKey: ["/api/user-activity-summary"],
  });

  if (!activitySummary) return null;

  const nudges: NudgeItem[] = [];
  const status = application?.status;

  if (activitySummary.propertySearches > 0 && !application) {
    nudges.push({
      id: "browsed-no-app",
      icon: Search,
      title: "You've been browsing properties",
      description: `You searched ${activitySummary.propertySearches} time${activitySummary.propertySearches > 1 ? "s" : ""} recently. Get pre-approved to make stronger offers.`,
      action: "Start Application",
      href: "/apply",
      priority: 1,
    });
  }

  if (activitySummary.calculatorUses > 0 && !application) {
    nudges.push({
      id: "calculated-no-app",
      icon: Calculator,
      title: "You've done the math",
      description: "You already know the numbers. Take the next step and see what you actually qualify for.",
      action: "Get Pre-Approved",
      href: "/apply",
      priority: 2,
    });
  }

  if (activitySummary.propertySearches > 2 && application && status === "pre_approved") {
    nudges.push({
      id: "active-browser",
      icon: Home,
      title: "Found the one?",
      description: "You've been actively searching. Lock in your rate and move forward with a full application.",
      action: "Continue Application",
      href: `/pipeline/${application.id}`,
      priority: 2,
    });
  }

  if (application && status === "draft") {
    nudges.push({
      id: "resume-draft",
      icon: FileText,
      title: "You have an unfinished application",
      description: "Pick up right where you left off. It only takes a few minutes to complete.",
      action: "Resume Application",
      href: "/apply",
      priority: 1,
    });
  }

  if (expirationInfo && expirationInfo.urgency === "expired" && application) {
    nudges.push({
      id: "expired-renew",
      icon: AlertTriangle,
      title: "Your pre-approval has expired",
      description: "Renew your pre-approval to keep shopping with confidence. It only takes a few minutes.",
      action: "Renew Now",
      href: "/apply",
      priority: 1,
    });
  }

  if (expirationInfo && expirationInfo.urgency === "urgent" && application) {
    nudges.push({
      id: "expiring-soon",
      icon: Clock,
      title: `Pre-approval expires in ${expirationInfo.daysLeft} day${expirationInfo.daysLeft !== 1 ? "s" : ""}`,
      description: "Found a home you love? Move quickly before your pre-approval expires.",
      action: "Browse Properties",
      href: "/properties",
      priority: 1,
    });
  }

  if (activitySummary.coachChats === 0 && !application) {
    nudges.push({
      id: "try-coach-new",
      icon: Bot,
      title: "Not sure where to start?",
      description: "Chat with our AI coach to understand your mortgage readiness and get a personalized plan.",
      action: "Talk to Coach",
      href: "/ai-coach",
      priority: 3,
    });
  }

  if (activitySummary.coachChats === 0 && application) {
    nudges.push({
      id: "try-coach",
      icon: MessageSquare,
      title: "Get personalized guidance",
      description: "Our AI homebuyer coach can answer your mortgage questions and help you understand your options.",
      action: "Chat with Coach",
      href: "/ai-coach",
      priority: 5,
    });
  }

  if (activitySummary.calculatorUses === 0 && application) {
    nudges.push({
      id: "try-calculator",
      icon: Calculator,
      title: "See what fits your budget",
      description: "Use our mortgage calculator to explore different payment scenarios and find your comfort zone.",
      action: "Open Calculator",
      href: "/calculators/mortgage",
      priority: 6,
    });
  }

  if (activitySummary.propertySearches === 0 && application && status === "pre_approved") {
    const approvedAmt = application.purchasePrice ? Number(application.purchasePrice) : 0;
    const amtStr = approvedAmt > 0 ? ` up to $${approvedAmt.toLocaleString()}` : "";
    nudges.push({
      id: "start-searching",
      icon: Search,
      title: "Ready to find your home",
      description: `You're pre-approved${amtStr}! Start browsing properties that match your budget.`,
      action: "Browse Properties",
      href: "/properties",
      priority: 3,
    });
  }

  if (application && status === "submitted" && activitySummary.totalPageViews > 5) {
    nudges.push({
      id: "app-submitted",
      icon: Clock,
      title: "Your application is being reviewed",
      description: "Most pre-approvals are processed within 1 business day. You'll be notified via email and dashboard as soon as we have a decision.",
      action: "View Status",
      href: `/pipeline/${application.id}`,
      priority: 4,
    });
  }

  if (application && status === "underwriting") {
    nudges.push({
      id: "underwriting-timeline",
      icon: Clock,
      title: "Underwriting in progress",
      description: "Your file is being reviewed by our underwriting team. This typically takes 3-5 business days. We'll reach out if we need anything.",
      action: "View Details",
      href: `/pipeline/${application.id}`,
      priority: 2,
    });
  }

  if (application && status === "conditional") {
    nudges.push({
      id: "conditional-action",
      icon: AlertCircle,
      title: "Conditional approval - action needed",
      description: "Your loan is conditionally approved! Review and fulfill the remaining conditions to move to final approval.",
      action: "View Conditions",
      href: `/pipeline/${application.id}`,
      priority: 1,
    });
  }

  if (activitySummary.totalPageViews > 8 && !application && activitySummary.calculatorUses === 0 && activitySummary.propertySearches === 0) {
    nudges.push({
      id: "high-engagement",
      icon: Sparkles,
      title: "You've been exploring Baranest",
      description: "Ready to take the next step? Our 3-minute pre-approval has no impact on your credit score.",
      action: "Get Started",
      href: "/apply",
      priority: 2,
    });
  }

  if (application && ["doc_collection", "processing"].includes(status || "") && activitySummary.totalPageViews > 3) {
    nudges.push({
      id: "docs-progress",
      icon: FileText,
      title: "Keep the momentum going",
      description: "Upload any remaining documents to speed up your approval. Every document helps us move faster.",
      action: "Upload Documents",
      href: "/documents",
      priority: 3,
    });
  }

  const deduped = nudges.filter(n => !whatsNextHrefs.some(wh => n.href === wh));
  const sorted = deduped.sort((a, b) => a.priority - b.priority).slice(0, 3);
  if (sorted.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="section-nudges">
      {sorted.map((nudge) => (
        <Card key={nudge.id} className="shadow-sm border-primary/10" data-testid={`nudge-${nudge.id}`}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <nudge.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm" data-testid={`text-nudge-title-${nudge.id}`}>{nudge.title}</p>
                <p className="text-xs text-muted-foreground">{nudge.description}</p>
              </div>
            </div>
            <Link href={nudge.href}>
              <Button size="sm" variant="outline" className="shrink-0 gap-1" data-testid={`button-nudge-${nudge.id}`}>
                {nudge.action}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  usePageView("/dashboard");
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

  const { data: coachConversations } = useQuery<{ id: number }[]>({
    queryKey: ["/api/coach/conversations"],
    enabled: !authLoading && !isStaff,
  });

  const [browsedProperties, setBrowsedProperties] = useState(false);
  useEffect(() => {
    try {
      setBrowsedProperties(localStorage.getItem("baranest_browsed_properties") === "true");
    } catch {}
  }, []);

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
  const expirationInfo = activeApplication ? getExpirationInfo(activeApplication) : null;
  const confidence = activeApplication ? getConfidenceLabel(activeApplication.status) : null;

  const offerCount = activeApplication ? (data?.loanOptionCounts?.[activeApplication.id] || 0) : 0;
  const hasOffers = offerCount > 0;
  const appOptions = (data?.recentOptions || []).filter(
    (opt: any) => activeApplication && opt.applicationId === activeApplication.id
  );
  const sortedRates = appOptions
    .map((o: any) => parseFloat(o.interestRate))
    .filter((r: number) => !isNaN(r))
    .sort((a: number, b: number) => a - b);
  const rateRange = hasOffers && sortedRates.length >= 2
    ? `${sortedRates[0].toFixed(2)}% - ${sortedRates[sortedRates.length - 1].toFixed(2)}%`
    : hasOffers && sortedRates.length === 1
    ? `${sortedRates[0].toFixed(2)}%`
    : null;
  const hmdaCompleted = activeApplication ? (data?.hmdaStatus?.[activeApplication.id] || false) : false;

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
                  {expirationInfo && (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <p className={`text-sm ${expirationInfo.urgency === "expired" ? "text-red-600 dark:text-red-400 font-medium" : expirationInfo.urgency === "urgent" ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`} data-testid="text-expiration">
                        {expirationInfo.urgency === "expired" 
                          ? "Pre-approval expired" 
                          : `Valid until ${expirationInfo.label}`}
                      </p>
                      {expirationInfo.urgency === "expired" && (
                        <Badge variant="destructive" data-testid="badge-expired">Expired</Badge>
                      )}
                      {expirationInfo.urgency === "urgent" && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400" data-testid="badge-expiring-soon">
                          {expirationInfo.daysLeft} day{expirationInfo.daysLeft !== 1 ? "s" : ""} left
                        </Badge>
                      )}
                    </div>
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
          hasCreditConsent={activeApplication ? (data?.verificationStatus?.[activeApplication.id]?.hasCreditConsent ?? true) : true}
          hasIdVerification={activeApplication ? (data?.verificationStatus?.[activeApplication.id]?.hasIdVerification ?? true) : true}
          hasBankConnected={activeApplication ? (data?.verificationStatus?.[activeApplication.id]?.hasBankConnected ?? true) : true}
          hasRateLocked={activeApplication ? (data?.verificationStatus?.[activeApplication.id]?.hasRateLocked ?? true) : true}
        />

        <PersonalizedNudges
          application={activeApplication || null}
          expirationInfo={expirationInfo}
          whatsNextHrefs={getNextActions({
            application: activeApplication || null,
            pendingTasks: pendingTaskCount,
            pendingDocuments: data?.stats?.pendingDocuments || 0,
            unreadMessages,
          }).map(a => a.href)}
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
                  <p className="text-lg font-semibold capitalize" data-testid="text-loan-type">
                    {activeApplication.preferredLoanType || "Conventional"}
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

        {activeApplication && !hmdaCompleted && (
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
            hasCoachSession={(coachConversations?.length || 0) > 0}
            hasBrowsedProperties={browsedProperties}
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
