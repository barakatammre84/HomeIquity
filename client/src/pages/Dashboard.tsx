import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, getStatusLabel } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BorrowerRequests } from "@/components/BorrowerRequests";
import { ApplicationSwitcher } from "@/components/ApplicationSwitcher";
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
} from "lucide-react";

interface DashboardData {
  applications: LoanApplication[];
  stats: {
    totalApplications: number;
    preApprovedAmount: string;
    pendingDocuments: number;
  };
  activities: DealActivity[];
}

// Map status to confidence labels (no scores, no underwriting language)
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

// Calculate expiration date (30 days from approval or creation)
function getExpirationDate(application: LoanApplication): string | null {
  if (application.status !== "pre_approved") return null;
  const createdDate = new Date(application.createdAt!);
  const expirationDate = new Date(createdDate);
  expirationDate.setDate(expirationDate.getDate() + 30);
  return expirationDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Format activity timestamp
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
  
  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  const isStaff = ["admin", "lender", "broker"].includes(user?.role || "");

  useEffect(() => {
    if (!authLoading && isStaff) {
      navigate("/staff-dashboard");
    }
  }, [authLoading, isStaff, navigate]);

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: !authLoading && !isStaff,
  });

  // Early return AFTER all hooks
  if (authLoading || isLoading || isStaff) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const applications = data?.applications || [];
  const activities = data?.activities || [];

  // Find the active application based on selection or default
  const defaultApp = applications.find(
    (app) => !["closed", "denied"].includes(app.status)
  );
  
  const activeApplication = selectedAppId 
    ? applications.find(app => app.id === selectedAppId) || defaultApp
    : defaultApp;

  const isPreApproved = activeApplication?.status === "pre_approved";
  const expirationDate = activeApplication ? getExpirationDate(activeApplication) : null;
  const confidence = activeApplication ? getConfidenceLabel(activeApplication.status) : null;

  // Simulated offers (would come from API in production)
  const hasOffers = isPreApproved;
  const offerCount = hasOffers ? 3 : 0;
  const rateRange = hasOffers ? "6.25% - 6.75%" : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-4">
        
        {/* DASHBOARD HEADER - Application switcher on the right */}
        <div className="flex items-center justify-between gap-4 flex-wrap border-b pb-4">
          <h1 className="text-xl font-semibold">Overview</h1>
          <ApplicationSwitcher
            applications={applications}
            activeApplicationId={activeApplication?.id}
            onSelectApplication={(app) => setSelectedAppId(app.id)}
          />
        </div>
        
        {/* 1. YOUR APPROVAL STATUS (PRIMARY CARD) - Clean design with border accent */}
        <Card 
          className={`shadow-lg ${isPreApproved ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-primary'}`} 
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

        {/* 2. WHAT WE NEED FROM YOU (ACTION CARD) - Auto-hides when empty */}
        {activeApplication && (
          <BorrowerRequests 
            applicationId={activeApplication.id} 
            data-testid="card-what-we-need"
          />
        )}

        {/* 3. YOUR LOAN SNAPSHOT - Clean grid with dividers */}
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

        {/* 4. OFFERS AVAILABLE - Clean card with emerald accent */}
        {hasOffers && activeApplication && (
          <Card className="shadow-md border-l-4 border-l-emerald-500" data-testid="card-offers">
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

        {/* 5. RECENT ACTIVITY - Clean with dividers */}
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
                {activities.slice(0, 3).map((activity, index) => (
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

        {/* Empty state for no application */}
        {!activeApplication && (
          <Card className="shadow-lg" data-testid="card-empty-state">
            <CardContent className="py-12 text-center">
              <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full border-2 border-dashed mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Ready to get started?</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Get pre-approved in as little as 3 minutes. No commitment, no credit impact.
              </p>
              <Link href="/apply">
                <Button size="lg" data-testid="button-get-preapproved">
                  Get Pre-Approved
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
