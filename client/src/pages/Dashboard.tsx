import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, getStatusLabel, getStatusColor } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DealTeam } from "@/components/DealTeam";
import { DocumentChecklist } from "@/components/DocumentChecklist";
import { ActionItems } from "@/components/ActionItems";
import { BorrowerRequests } from "@/components/BorrowerRequests";
import { ConsentsCard } from "@/components/ConsentsCard";
import type { LoanApplication, DealActivity } from "@shared/schema";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Users,
  Phone,
  BookOpen,
  Home,
  DollarSign,
  TrendingUp,
  ArrowRight,
  CheckCheck,
  Sparkles,
  Target,
  Shield,
  Info,
  Zap,
  Bell,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DashboardData {
  applications: LoanApplication[];
  stats: {
    totalApplications: number;
    preApprovedAmount: string;
    pendingDocuments: number;
  };
  activities: DealActivity[];
}

const resources = [
  {
    icon: Home,
    title: "Home affordability calculator",
    description: "See what you can afford",
    link: "/resources/calculator",
  },
  {
    icon: BookOpen,
    title: "7 must-ask questions before you make an offer",
    description: "Helpful guide",
    link: "/resources/questions",
  },
  {
    icon: FileText,
    title: "Points, credits, and what's right for you",
    description: "Learn more",
    link: "/resources/points",
  },
];

const nextSteps = [
  {
    title: "We're finding the right Loan Consultant",
    description: "We're finding the right Loan Consultant to help you personalize your rate!",
    details: [
      "Unlock potential savings and exclusive options",
      "Get a dedicated expert to guide you",
      "Find a financing solution tailored to your goals",
    ],
    cta: "Your Loan Consultant will be assigned soon",
    consultants: [
      { name: "Sarah Online Mortgage Advisor", role: "Expert" },
      { name: "Jamie Fast Closing Team", role: "Specialist" },
    ],
  },
  {
    title: "Complete tasks to close on your new home",
    description: "Lock your rate, upload documents, and complete your verification.",
  },
];

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

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

  if (authLoading || isLoading || isStaff) {
    return (
      <div className="p-8">
        <Skeleton className="mb-8 h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const applications = data?.applications || [];
  const stats = data?.stats || {
    totalApplications: 0,
    preApprovedAmount: "0",
    pendingDocuments: 0,
  };

  const activeApplication = applications.find(
    (app) => !["closed", "denied"].includes(app.status)
  );

  const isPreApproved = activeApplication?.status === "pre_approved";

  return (
    <>
      {isPreApproved ? (
        <div className="min-h-screen">
          {/* Compact Pre-Approved Banner */}
          <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-500">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,rgba(255,255,255,0.15),transparent_50%)]" />
            
            <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                    <CheckCircle2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold text-white sm:text-2xl" data-testid="text-preapproval-status">
                        Pre-Approved
                      </h1>
                      <Badge className="bg-white/20 text-white border-0 text-xs" data-testid="badge-active">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                    <p className="text-emerald-100 text-sm" data-testid="text-preapproval-banner">
                      Up to <span className="font-bold text-white" data-testid="text-preapproval-amount">{formatCurrency(activeApplication?.preApprovalAmount || activeApplication?.purchasePrice || "0")}</span>
                    </p>
                  </div>
                </div>
                
                {activeApplication && (
                  <Link href={`/pipeline/${activeApplication.id}`}>
                    <Button className="bg-white text-emerald-600 shadow-lg gap-2" data-testid="button-view-progress">
                      View Loan Progress
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="space-y-8">
              {/* Priority Actions Section */}
              <section data-testid="section-priority-actions">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                      <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight" data-testid="heading-priority-actions">Priority Actions</h3>
                      <p className="text-sm text-muted-foreground" data-testid="text-priority-subtitle">Complete these to keep your loan moving</p>
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid="button-info-priority">
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p className="text-sm">These items need your attention first. Completing them quickly helps avoid delays in your loan process.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                {activeApplication && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="absolute -top-2 -right-2 z-10" data-testid="badge-tasks-indicator">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg cursor-help">
                              <Bell className="h-3 w-3" />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">Tasks assigned to you by your loan team</p>
                        </TooltipContent>
                      </Tooltip>
                      <BorrowerRequests applicationId={activeApplication.id} />
                    </div>
                    <div className="relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="absolute -top-2 -right-2 z-10" data-testid="badge-consents-indicator">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-lg cursor-help">
                              <Shield className="h-3 w-3" />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">Required authorizations before we can proceed</p>
                        </TooltipContent>
                      </Tooltip>
                      <ConsentsCard applicationId={activeApplication.id} />
                    </div>
                  </div>
                )}
              </section>

              {/* Documents & Verification Section */}
              <section data-testid="section-documents">
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold tracking-tight" data-testid="heading-documents">Documents & Verification</h3>
                      <p className="text-sm text-muted-foreground" data-testid="text-documents-subtitle">Upload and verify your information</p>
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid="button-info-documents">
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p className="text-sm">We need these documents to verify your application. Upload them as soon as possible to speed up your approval.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                {activeApplication && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <ActionItems applicationId={activeApplication.id} compact maxItems={4} />
                    <DocumentChecklist applicationId={activeApplication.id} compact />
                  </div>
                )}
              </section>

              {/* Team & Resources Row */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Team Section */}
                <section data-testid="section-team">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="text-lg font-bold tracking-tight" data-testid="heading-team">Your Team</h3>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid="button-info-team">
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <p className="text-sm">Your dedicated loan team is here to help you every step of the way. Reach out anytime with questions.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  
                  {activeApplication && (
                    <Card>
                      <CardContent className="p-4">
                        <DealTeam applicationId={activeApplication.id} compact />
                      </CardContent>
                    </Card>
                  )}
                </section>

                {/* Quick Resources */}
                <section data-testid="section-resources">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <BookOpen className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="text-lg font-bold tracking-tight" data-testid="heading-resources">Quick Resources</h3>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid="button-info-resources">
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <p className="text-sm">Helpful guides and tools to support your home buying journey.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      {resources.map((resource, index) => (
                        <Link key={resource.title} href={resource.link} data-testid={`link-resource-${index}`}>
                          <div className="flex items-center gap-3 p-2 rounded-lg">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                              <resource.icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm font-medium truncate" data-testid={`text-resource-title-${index}`}>{resource.title}</p>
                              <p className="text-xs text-muted-foreground" data-testid={`text-resource-desc-${index}`}>{resource.description}</p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </Link>
                      ))}
                    </CardContent>
                  </Card>
                </section>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="min-h-screen">
          {/* Premium Dashboard Header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
            
            <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl" data-testid="heading-welcome">
                    Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
                  </h1>
                  <p className="mt-1 text-primary-foreground/80" data-testid="text-welcome-subtitle">
                    Track your loan applications and manage your documents
                  </p>
                </div>
                <Link href="/apply">
                  <Button className="bg-white text-primary shadow-lg gap-2" data-testid="button-new-application">
                    <FileText className="h-4 w-4" />
                    New Application
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="mx-auto max-w-7xl px-4 -mt-6 sm:px-6 lg:px-8">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="shadow-lg border-0" data-testid="card-stat-applications">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <FileText className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground" data-testid="label-applications">Applications</p>
                    <p className="text-3xl font-bold" data-testid="text-total-applications">
                      {stats.totalApplications}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0" data-testid="card-stat-preapproved">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
                    <DollarSign className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground" data-testid="label-preapproved">Pre-Approved</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-preapproved-amount">
                      {formatCurrency(stats.preApprovedAmount)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0" data-testid="card-stat-pending">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
                    <AlertCircle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground" data-testid="label-pending-documents">Pending Documents</p>
                    <p className="text-3xl font-bold" data-testid="text-pending-documents">
                      {stats.pendingDocuments}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content */}
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            {activeApplication && (
              <>
                <div className="grid gap-6 md:grid-cols-2 mb-10">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <CardTitle data-testid="heading-current-application">Current Application</CardTitle>
                          <CardDescription data-testid="text-application-date">
                            Started {new Date(activeApplication.createdAt!).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Badge className={getStatusColor(activeApplication.status)} data-testid="badge-application-status">
                          {getStatusLabel(activeApplication.status)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <p className="font-medium mb-2" data-testid="text-purchase-price">{formatCurrency(activeApplication.purchasePrice || "0")} Purchase</p>
                          <p className="text-sm text-muted-foreground" data-testid="text-property-location">
                            {activeApplication.propertyCity}, {activeApplication.propertyState}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2" data-testid="label-down-payment">Down Payment</p>
                          <p className="text-base" data-testid="text-down-payment">{formatCurrency(activeApplication.downPayment || "0")}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <DealTeam applicationId={activeApplication.id} />
                </div>
                
                {/* Priority Actions Section */}
                <section data-testid="section-priority-actions-nonpreapproved" className="mb-8">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                        <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold tracking-tight" data-testid="heading-priority-actions-nonpreapproved">Priority Actions</h3>
                        <p className="text-sm text-muted-foreground" data-testid="text-priority-subtitle-nonpreapproved">Complete these to keep your loan moving</p>
                      </div>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid="button-info-priority-nonpreapproved">
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <p className="text-sm">These items need your attention first. Completing them quickly helps avoid delays in your loan process.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="absolute -top-2 -right-2 z-10" data-testid="badge-tasks-nonpreapproved">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg cursor-help">
                              <Bell className="h-3 w-3" />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">Tasks assigned to you by your loan team</p>
                        </TooltipContent>
                      </Tooltip>
                      <BorrowerRequests applicationId={activeApplication.id} />
                    </div>
                    <div className="relative">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="absolute -top-2 -right-2 z-10" data-testid="badge-consents-nonpreapproved">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-lg cursor-help">
                              <Shield className="h-3 w-3" />
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-sm">Required authorizations before we can proceed</p>
                        </TooltipContent>
                      </Tooltip>
                      <ConsentsCard applicationId={activeApplication.id} />
                    </div>
                  </div>
                </section>

                {/* Documents & Verification Section */}
                <section data-testid="section-documents-nonpreapproved">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold tracking-tight" data-testid="heading-documents-nonpreapproved">Documents & Verification</h3>
                        <p className="text-sm text-muted-foreground" data-testid="text-documents-subtitle-nonpreapproved">Upload and verify your information</p>
                      </div>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid="button-info-documents-nonpreapproved">
                          <Info className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <p className="text-sm">We need these documents to verify your application. Upload them as soon as possible to speed up your approval.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <ActionItems applicationId={activeApplication.id} compact maxItems={4} />
                    <DocumentChecklist applicationId={activeApplication.id} compact />
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
