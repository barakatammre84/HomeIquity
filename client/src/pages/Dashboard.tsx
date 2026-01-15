import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, getStatusLabel, getStatusColor } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
            <div className="space-y-8 px-4 py-8 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-4xl">
                <div className="mb-8">
                  <div className="mb-2 text-sm font-medium text-green-600 dark:text-green-400">
                    Your overview
                  </div>
                  <div className="mb-4">
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                      Congratulations!
                    </h1>
                    <h2 className="text-3xl font-bold tracking-tight text-green-600 dark:text-green-400 sm:text-4xl">
                      You're pre-approved!
                    </h2>
                  </div>
                  <p className="text-base text-muted-foreground">
                    Welcome to your personalized home buying dashboard. We're on the next steps of your journey.
                    Let us know if you need any help along the way!
                  </p>
                </div>

                <Card className="mb-8 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Pre-approved for</p>
                        <p className="text-4xl font-bold text-green-700 dark:text-green-400">
                          {formatCurrency(activeApplication?.preApprovalAmount || activeApplication?.purchasePrice || "0")}
                        </p>
                      </div>
                      <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                    </div>
                    {activeApplication && (
                      <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                        <Link href={`/pipeline/${activeApplication.id}`}>
                          <Button className="w-full gap-2" data-testid="button-view-progress">
                            View Loan Progress
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <h3 className="text-2xl font-bold tracking-tight">Next steps</h3>

                  {nextSteps.map((step, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <CardTitle className="text-lg">{step.title}</CardTitle>
                        {step.description && (
                          <CardDescription>{step.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {step.details && (
                          <div className="space-y-3">
                            {step.details.map((detail, i) => (
                              <div key={i} className="flex gap-3 text-sm">
                                <CheckCheck className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                                <span>{detail}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {step.consultants && (
                          <div className="space-y-3 border-t pt-4">
                            <p className="text-sm font-medium">Meet your team</p>
                            {step.consultants.map((consultant, i) => (
                              <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                                <div>
                                  <p className="text-sm font-medium">{consultant.name}</p>
                                  <p className="text-xs text-muted-foreground">{consultant.role}</p>
                                </div>
                              </div>
                            ))}
                            {step.cta && (
                              <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700">
                                <Phone className="h-4 w-4" />
                                {step.cta}
                              </Button>
                            )}
                          </div>
                        )}

                        {index === 1 && (
                          <Button
                            variant="outline"
                            className="w-full gap-2"
                            data-testid="button-view-tasks"
                          >
                            View Tasks
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="mt-12">
                  <h3 className="text-2xl font-bold tracking-tight mb-6">More resources</h3>
                  <div className="grid gap-6 md:grid-cols-3">
                    {resources.map((resource) => (
                      <Card key={resource.title} className="hover-elevate">
                        <CardContent className="p-6">
                          <resource.icon className="h-8 w-8 text-green-600 dark:text-green-400 mb-3" />
                          <h4 className="font-semibold mb-2">{resource.title}</h4>
                          <p className="text-sm text-muted-foreground mb-4">{resource.description}</p>
                          <Link href={resource.link}>
                            <Button variant="ghost" size="sm" className="gap-2 h-8 px-2">
                              Learn
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
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
                    <FileText className="h-4 w-4" />
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
                      <AlertCircle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
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
              )}
            </div>
          )}
    </>
  );
}
