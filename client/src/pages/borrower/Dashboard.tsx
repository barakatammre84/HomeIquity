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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
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

function getPersonalizedGreeting(user: any, application: LoanApplication | null, goal: string | null): { title: string; subtitle: string } {
  const name = user?.firstName || "";
  const greeting = name ? `Hi, ${name}` : "Welcome back";

  if (!application) {
    switch (goal) {
      case "buying_first_home":
        return { title: greeting, subtitle: "Ready to take the first step toward homeownership? We'll make it simple." };
      case "buying_next_home":
        return { title: greeting, subtitle: "Let's find the right mortgage for your next home." };
      case "refinancing":
        return { title: greeting, subtitle: "See if refinancing could save you money each month." };
      case "investing":
        return { title: greeting, subtitle: "Let's explore financing for your next investment property." };
      case "just_exploring":
        return { title: greeting, subtitle: "Take your time exploring. We're here when you're ready." };
      default:
        return { title: greeting, subtitle: "Let's get you on the path to homeownership." };
    }
  }

  switch (application.status) {
    case "draft":
      return { title: greeting, subtitle: "You have an unfinished application. Pick up where you left off." };
    case "submitted":
    case "analyzing":
      return { title: greeting, subtitle: "Your application is being reviewed. We'll have an answer shortly." };
    case "pre_approved":
      return { title: greeting, subtitle: "You're pre-approved. Time to find your home." };
    case "doc_collection":
    case "processing":
      return { title: greeting, subtitle: "We're processing your documents. Upload anything still needed." };
    case "underwriting":
      return { title: greeting, subtitle: "Your file is with underwriting. We'll keep you posted." };
    case "conditional":
      return { title: greeting, subtitle: "Almost there. A few conditions left to clear." };
    case "clear_to_close":
    case "closing":
      return { title: greeting, subtitle: "You're clear to close. The finish line is in sight." };
    case "denied":
    case "declined":
      return { title: greeting, subtitle: "Let's look at your options and find a path forward." };
    default:
      return { title: greeting, subtitle: "Here's where things stand with your mortgage." };
  }
}

function CombinedNextSteps({
  application,
  expirationInfo,
  pendingTasks,
  pendingDocuments,
  unreadMessages,
  verificationStatus,
  activitySummary,
}: {
  application: LoanApplication | null;
  expirationInfo: { label: string; daysLeft: number; urgency: "expired" | "urgent" | "normal" } | null;
  pendingTasks: number;
  pendingDocuments: number;
  unreadMessages: number;
  verificationStatus?: { hasCreditConsent: boolean; hasIdVerification: boolean; hasBankConnected: boolean; hasRateLocked: boolean };
  activitySummary?: { totalPageViews: number; propertySearches: number; calculatorUses: number; coachChats: number; propertyViews: number } | null;
}) {
  const whatsNextActions = getNextActions({
    application,
    pendingTasks,
    pendingDocuments,
    unreadMessages,
    hasCreditConsent: verificationStatus?.hasCreditConsent ?? true,
    hasIdVerification: verificationStatus?.hasIdVerification ?? true,
    hasBankConnected: verificationStatus?.hasBankConnected ?? true,
    hasRateLocked: verificationStatus?.hasRateLocked ?? true,
  });

  const whatsNextHrefs = whatsNextActions.map(a => a.href);

  const nudges: NudgeItem[] = [];
  const status = application?.status;

  if (activitySummary) {
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
      description: "Renew your pre-approval to keep shopping with confidence.",
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

  if (application && status === "conditional") {
    nudges.push({
      id: "conditional-action",
      icon: AlertCircle,
      title: "Conditional approval — action needed",
      description: "Review and fulfill the remaining conditions to move to final approval.",
      action: "View Conditions",
      href: `/pipeline/${application.id}`,
      priority: 1,
    });
  }

  const deduped = nudges.filter(n => !whatsNextHrefs.some(wh => n.href === wh));
  const sortedNudges = deduped.sort((a, b) => a.priority - b.priority).slice(0, 2);

  const allItems = [...whatsNextActions.slice(0, 2), ...sortedNudges.slice(0, 1)];

  if (allItems.length === 0) return null;

  const primary = whatsNextActions[0];
  const secondary = [...whatsNextActions.slice(1, 3), ...sortedNudges.slice(0, 1)].slice(0, 2);

  return (
    <div className="space-y-3" data-testid="section-next-steps">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Your Next Steps
      </h3>

      {primary && (
        <Card className="hover-elevate" data-testid="card-primary-action">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 flex-wrap">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${primary.iconColor}`}>
                <primary.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm" data-testid="text-primary-action-title">
                  {primary.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {primary.description}
                </p>
              </div>
              <Link href={primary.href} className="shrink-0" data-testid="link-primary-action">
                <Button size="sm" data-testid="button-primary-action">
                  {primary.buttonLabel}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {secondary.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="section-secondary-actions">
          {secondary.map((item, index) => {
            const isNudge = 'id' in item;
            const Icon = isNudge ? (item as NudgeItem).icon : (item as any).icon;
            const title = isNudge ? (item as NudgeItem).title : (item as any).title;
            const href = isNudge ? (item as NudgeItem).href : (item as any).href;
            const label = isNudge ? (item as NudgeItem).action : (item as any).buttonLabel;

            return (
              <Card key={index} className="hover-elevate" data-testid={`card-secondary-action-${index}`}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{title}</p>
                    </div>
                    <Link href={href} className="shrink-0" data-testid={`link-secondary-action-${index}`}>
                      <Button variant="ghost" size="sm" data-testid={`button-secondary-action-${index}`}>
                        {label}
                        <ArrowRight className="h-3 w-3 ml-0.5" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LoanSnapshotInline({ application, isPreApproved }: { application: LoanApplication; isPreApproved: boolean }) {
  const stats = [
    {
      icon: Home,
      label: "Purchase Price",
      value: formatCurrency(application.preApprovalAmount || application.purchasePrice || "0"),
      verified: isPreApproved,
    },
    {
      icon: DollarSign,
      label: "Down Payment",
      value: formatCurrency(application.downPayment || "0"),
      verified: isPreApproved,
    },
    {
      icon: Calendar,
      label: "Est. Payment",
      value: `${formatCurrency(Math.round((Number(application.purchasePrice || 0) - Number(application.downPayment || 0)) * 0.006).toString())}/mo`,
      verified: false,
    },
    {
      icon: Percent,
      label: "Loan Type",
      value: application.preferredLoanType || "Conventional",
      verified: isPreApproved,
      capitalize: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t" data-testid="section-loan-snapshot">
      {stats.map((stat) => (
        <div key={stat.label} className="space-y-0.5">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <stat.icon className="h-3 w-3" />
            <span>{stat.label}</span>
            {stat.verified && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <ShieldCheck className="h-3 w-3 text-emerald-500 cursor-help" data-testid={`icon-verified-${stat.label.toLowerCase().replace(/\s/g, '-')}`} />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs">
                  <p>Verified from your pre-approval. This value is locked to ensure accuracy.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className={`text-sm font-semibold ${stat.capitalize ? "capitalize" : ""}`} data-testid={`text-snapshot-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
            {stat.value}
          </p>
        </div>
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

  const { data: homeownershipGoal } = useQuery<{ goal: string | null }>({
    queryKey: ["/api/homeownership-goal"],
    enabled: !authLoading && !isStaff,
  });

  const { data: activitySummary } = useQuery<{
    totalPageViews: number;
    propertySearches: number;
    calculatorUses: number;
    coachChats: number;
    propertyViews: number;
  }>({
    queryKey: ["/api/user-activity-summary"],
    enabled: !authLoading && !isStaff,
  });

  const [browsedProperties, setBrowsedProperties] = useState(false);
  useEffect(() => {
    try {
      setBrowsedProperties(localStorage.getItem("homiquity_browsed_properties") === "true");
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

  const { title: greetingTitle, subtitle: greetingSubtitle } = getPersonalizedGreeting(
    user,
    activeApplication || null,
    homeownershipGoal?.goal || null
  );

  const verificationStatus = activeApplication
    ? data?.verificationStatus?.[activeApplication.id]
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8 space-y-4">

        <div className="flex items-center justify-between gap-4 flex-wrap border-b pb-4">
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-dashboard-title">
              {greetingTitle}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-dashboard-subtitle">
              {greetingSubtitle}
            </p>
          </div>
          <ApplicationSwitcher
            applications={applications}
            activeApplicationId={activeApplication?.id}
            onSelectApplication={(app) => setSelectedAppId(app.id)}
          />
        </div>

        {activeApplication ? (
          <Card className="shadow-md" data-testid="card-status-hub">
            <CardContent className="p-5">
              <div className="flex items-start gap-4 flex-wrap">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 ${isPreApproved ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-primary/30 text-primary'}`}>
                  {isPreApproved ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Clock className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold" data-testid="text-approval-stage">
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
                      <p className={`text-xs ${expirationInfo.urgency === "expired" ? "text-red-600 dark:text-red-400 font-medium" : expirationInfo.urgency === "urgent" ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`} data-testid="text-expiration">
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

              {activeApplication.status !== "draft" && (
                <div className="mt-4 pt-4 border-t">
                  <JourneyTracker status={activeApplication.status} />
                </div>
              )}

              <LoanSnapshotInline application={activeApplication} isPreApproved={isPreApproved} />
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-md" data-testid="card-approval-status">
            <CardContent className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <p className="text-muted-foreground mb-4">No active application yet</p>
              <Link href="/apply">
                <Button data-testid="button-start-application">
                  Start Your Application
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {activeApplication && (
          <BorrowerRequests
            applicationId={activeApplication.id}
            data-testid="card-what-we-need"
          />
        )}

        <CombinedNextSteps
          application={activeApplication || null}
          expirationInfo={expirationInfo}
          pendingTasks={pendingTaskCount}
          pendingDocuments={data?.stats?.pendingDocuments || 0}
          unreadMessages={unreadMessages}
          verificationStatus={verificationStatus}
          activitySummary={activitySummary}
        />

        {hasOffers && activeApplication && (
          <Card className="hover-elevate" data-testid="card-offers">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-emerald-500">
                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm" data-testid="text-offer-count">
                      {offerCount} Offer{offerCount !== 1 ? "s" : ""} Available
                    </p>
                    {rateRange && (
                      <p className="text-xs text-muted-foreground" data-testid="text-rate-range">
                        Rates from {rateRange}
                      </p>
                    )}
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
          <Card className="hover-elevate" data-testid="card-hmda-compliance">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border text-muted-foreground">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm" data-testid="text-hmda-title">
                      Government Monitoring
                    </p>
                    <p className="text-xs text-muted-foreground">
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
          <Card data-testid="card-recent-activity">
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="divide-y">
                {activities.slice(0, 4).map((activity, index) => (
                  <div key={activity.id} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0" data-testid={`row-activity-${index}`}>
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border mt-0.5">
                      {!activity.performedBy ? (
                        <Bot className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <User className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground" data-testid={`text-activity-desc-${index}`}>
                        {activity.description || activity.title}
                      </p>
                      <span className="text-[11px] text-muted-foreground" data-testid={`text-activity-time-${index}`}>
                        {formatActivityTime(activity.createdAt!)}
                      </span>
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
    <Card className="hover-elevate" data-testid="card-prequal-letter">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-amber-500">
              <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-medium text-sm" data-testid="text-prequal-title">
                Pre-Qualification Letter
              </p>
              <p className="text-xs text-muted-foreground">
                {hasLetter
                  ? "Your letter is ready to download"
                  : "Get a preliminary qualification letter"}
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
