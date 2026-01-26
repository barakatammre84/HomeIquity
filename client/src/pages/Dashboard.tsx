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
          {/* Premium Pre-Approved Hero */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.2),transparent_50%)]" />
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
            
            <div className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
              <div className="flex items-center gap-2 text-emerald-100 mb-4">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-medium">Your Overview</span>
              </div>
              
              <div className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  Congratulations!
                </h1>
                <h2 className="text-3xl font-bold tracking-tight text-white/90 sm:text-4xl lg:text-5xl">
                  You're Pre-Approved
                </h2>
              </div>
              
              <p className="max-w-2xl text-lg text-emerald-50/90">
                Welcome to your personalized home buying dashboard. We're on the next steps of your journey.
              </p>
              
              {/* Pre-approval Amount Card */}
              <div className="mt-8 inline-flex items-center gap-6 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-6">
                <div>
                  <p className="text-sm text-emerald-100 mb-1">Pre-approved for up to</p>
                  <p className="text-4xl font-bold text-white sm:text-5xl">
                    {formatCurrency(activeApplication?.preApprovalAmount || activeApplication?.purchasePrice || "0")}
                  </p>
                </div>
                <div className="hidden sm:flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
                  <CheckCircle2 className="h-8 w-8 text-white" />
                </div>
              </div>
              
              {activeApplication && (
                <div className="mt-8">
                  <Link href={`/pipeline/${activeApplication.id}`}>
                    <Button size="lg" className="bg-white text-emerald-600 shadow-lg gap-2" data-testid="button-view-progress">
                      View Loan Progress
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="space-y-10">
              {/* To-do Section */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">Your To-Do List</h3>
                </div>
                
                {activeApplication && (
                  <div className="grid gap-6 md:grid-cols-2">
                    <ActionItems applicationId={activeApplication.id} compact maxItems={4} />
                    <DocumentChecklist applicationId={activeApplication.id} compact />
                  </div>
                )}
              </section>

              {/* Team Section */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">Your Team</h3>
                </div>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Your Loan Team</CardTitle>
                    <CardDescription>
                      Your dedicated team is here to help you every step of the way
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {nextSteps[0].details?.map((detail, i) => (
                        <div key={i} className="flex gap-3 text-sm">
                          <CheckCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{detail}</span>
                        </div>
                      ))}
                    </div>
                    {activeApplication && (
                      <div className="border-t pt-4">
                        <DealTeam applicationId={activeApplication.id} compact />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>

              {/* Resources Section */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight">More Resources</h3>
                </div>
                
                <div className="grid gap-6 md:grid-cols-3">
                  {resources.map((resource) => (
                    <Card key={resource.title} className="group hover-elevate transition-all">
                      <CardContent className="p-6">
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/50 transition-colors">
                          <resource.icon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h4 className="font-semibold mb-2">{resource.title}</h4>
                        <p className="text-sm text-muted-foreground mb-4">{resource.description}</p>
                        <Link href={resource.link}>
                          <Button variant="ghost" size="sm" className="gap-2 h-8 px-0 text-primary hover:text-primary">
                            Learn more
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
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
                  <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
                  </h1>
                  <p className="mt-1 text-primary-foreground/80">
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
              <Card className="shadow-lg border-0">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <FileText className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Applications</p>
                    <p className="text-3xl font-bold" data-testid="text-total-applications">
                      {stats.totalApplications}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
                    <DollarSign className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pre-Approved</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-preapproved-amount">
                      {formatCurrency(stats.preApprovedAmount)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg border-0">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
                    <AlertCircle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Documents</p>
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
                      <div className="space-y-4">
                        <div>
                          <p className="font-medium mb-2">{formatCurrency(activeApplication.purchasePrice || "0")} Purchase</p>
                          <p className="text-sm text-muted-foreground">
                            {activeApplication.propertyCity}, {activeApplication.propertyState}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Down Payment</p>
                          <p className="text-base">{formatCurrency(activeApplication.downPayment || "0")}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <DealTeam applicationId={activeApplication.id} />
                </div>
                
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">Your To-Do List</h3>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <ActionItems applicationId={activeApplication.id} compact maxItems={4} />
                  <DocumentChecklist applicationId={activeApplication.id} compact />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
