import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { formatCurrency, getStatusLabel, getStatusColor } from "@/lib/authUtils";
import type { LoanApplication } from "@shared/schema";
import {
  Home,
  DollarSign,
  Percent,
  Calendar,
  MapPin,
  User,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Users,
} from "lucide-react";

interface DashboardData {
  applications: LoanApplication[];
}

export default function ApplicationSummary() {
  const { isLoading: authLoading } = useAuth();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: !authLoading,
  });

  if (authLoading || isLoading) {
    return (
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex-1 p-8">
            <Skeleton className="mb-8 h-8 w-48" />
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  const applications = data?.applications || [];
  const activeApplication = applications.find(
    (app) => !["closed", "denied"].includes(app.status)
  );

  const loanAmount = activeApplication
    ? parseFloat(activeApplication.purchasePrice || "0") - parseFloat(activeApplication.downPayment || "0")
    : 0;

  const downPaymentPercent = activeApplication && parseFloat(activeApplication.purchasePrice || "0") > 0
    ? (parseFloat(activeApplication.downPayment || "0") / parseFloat(activeApplication.purchasePrice || "0")) * 100
    : 0;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="border-b p-4 sm:p-6 lg:p-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Application summary
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review your loan application details
            </p>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {!activeApplication ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Home className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-lg font-medium">No active application</p>
                  <p className="text-sm text-muted-foreground">
                    Start your pre-approval to see your application summary
                  </p>
                  <Button className="mt-6 gap-2" data-testid="button-start-application">
                    Start Pre-Approval
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg">Loan Details</CardTitle>
                        <CardDescription>Your mortgage summary</CardDescription>
                      </div>
                      <Badge className={getStatusColor(activeApplication.status)}>
                        {getStatusLabel(activeApplication.status)}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-lg bg-muted/50 p-4">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <DollarSign className="h-4 w-4" />
                            <span className="text-xs">Purchase Price</span>
                          </div>
                          <p className="mt-1 text-xl font-semibold" data-testid="text-purchase-price">
                            {formatCurrency(activeApplication.purchasePrice || "0")}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-4">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <DollarSign className="h-4 w-4" />
                            <span className="text-xs">Down Payment</span>
                          </div>
                          <p className="mt-1 text-xl font-semibold" data-testid="text-down-payment">
                            {formatCurrency(activeApplication.downPayment || "0")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ({downPaymentPercent.toFixed(1)}%)
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-4">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Home className="h-4 w-4" />
                            <span className="text-xs">Loan Amount</span>
                          </div>
                          <p className="mt-1 text-xl font-semibold" data-testid="text-loan-amount">
                            {formatCurrency(loanAmount.toString())}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-4">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Percent className="h-4 w-4" />
                            <span className="text-xs">LTV Ratio</span>
                          </div>
                          <p className="mt-1 text-xl font-semibold">
                            {activeApplication.ltvRatio
                              ? `${parseFloat(activeApplication.ltvRatio).toFixed(1)}%`
                              : `${(100 - downPaymentPercent).toFixed(1)}%`}
                          </p>
                        </div>
                      </div>

                      {activeApplication.preApprovalAmount && (
                        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4 border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">
                              Pre-approved for {formatCurrency(activeApplication.preApprovalAmount)}
                            </span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Borrower Information</CardTitle>
                      <CardDescription>Your financial profile</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <DollarSign className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Annual Income</p>
                            <p className="font-medium" data-testid="text-annual-income">
                              {formatCurrency(activeApplication.annualIncome || "0")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Percent className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Credit Score</p>
                            <p className="font-medium" data-testid="text-credit-score">
                              {activeApplication.creditScore || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Briefcase className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Employment</p>
                            <p className="font-medium capitalize">
                              {activeApplication.employmentType?.replace("_", " ") || "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <Calendar className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Years Employed</p>
                            <p className="font-medium">
                              {activeApplication.employmentYears || 0} years
                            </p>
                          </div>
                        </div>
                      </div>

                      {activeApplication.dtiRatio && (
                        <div className="rounded-lg bg-muted/50 p-4">
                          <p className="text-sm font-medium">Debt-to-Income Ratio</p>
                          <p className="text-2xl font-bold">
                            {parseFloat(activeApplication.dtiRatio).toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {parseFloat(activeApplication.dtiRatio) <= 43
                              ? "Your DTI ratio is within acceptable limits"
                              : "Your DTI ratio is above the typical threshold of 43%"}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Property Details</CardTitle>
                      <CardDescription>Your target property</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                          <Home className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Property Type</p>
                          <p className="font-medium capitalize">
                            {activeApplication.propertyType?.replace("_", " ") || "Single Family Home"}
                          </p>
                        </div>
                      </div>

                      {(activeApplication.propertyCity || activeApplication.propertyState) && (
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                            <MapPin className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Location</p>
                            <p className="font-medium">
                              {[activeApplication.propertyCity, activeApplication.propertyState]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Loan Purpose</p>
                          <p className="font-medium capitalize">
                            {activeApplication.loanPurpose?.replace("_", " ") || "Purchase"}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3">
                          <p className="text-xs text-muted-foreground">Preferred Loan</p>
                          <p className="font-medium uppercase">
                            {activeApplication.preferredLoanType || "Conventional"}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        {activeApplication.isFirstTimeBuyer && (
                          <Badge variant="secondary" className="text-xs">
                            First Time Buyer
                          </Badge>
                        )}
                        {activeApplication.isVeteran && (
                          <Badge variant="secondary" className="text-xs">
                            Veteran
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Real estate agent</CardTitle>
                          <CardDescription>Connect with an agent</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Have a real estate agent? Enter their information below so we can keep them
                        in the loop on your progress.
                      </p>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="agent-name">Agent name</Label>
                          <Input
                            id="agent-name"
                            placeholder="Enter agent's full name"
                            data-testid="input-agent-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="agent-email">Agent email</Label>
                          <Input
                            id="agent-email"
                            type="email"
                            placeholder="agent@example.com"
                            data-testid="input-agent-email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="agent-phone">Agent phone</Label>
                          <Input
                            id="agent-phone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            data-testid="input-agent-phone"
                          />
                        </div>
                        <Button className="w-full" data-testid="button-save-agent">
                          Save agent information
                        </Button>
                      </div>

                      <div className="border-t pt-4">
                        <p className="text-sm text-muted-foreground">
                          Don't have an agent yet?
                        </p>
                        <Button
                          variant="outline"
                          className="mt-2 w-full gap-2"
                          data-testid="button-find-agent"
                        >
                          Find a Better agent
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Application timeline</CardTitle>
                      <CardDescription>Track your progress</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Application submitted</p>
                            <p className="text-xs text-muted-foreground">
                              {activeApplication.createdAt
                                ? new Date(activeApplication.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "Today"}
                            </p>
                          </div>
                        </div>

                        {activeApplication.status === "pre_approved" && (
                          <div className="flex items-start gap-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">Pre-approved</p>
                              <p className="text-xs text-muted-foreground">
                                {activeApplication.aiAnalyzedAt
                                  ? new Date(activeApplication.aiAnalyzedAt).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : "Today"}
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/50">
                            <span className="text-[10px] text-muted-foreground">2</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-muted-foreground">
                              Complete verification
                            </p>
                            <p className="text-xs text-muted-foreground">Pending</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/50">
                            <span className="text-[10px] text-muted-foreground">3</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-muted-foreground">
                              Final approval
                            </p>
                            <p className="text-xs text-muted-foreground">Pending</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/50">
                            <span className="text-[10px] text-muted-foreground">4</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-muted-foreground">
                              Close on your home
                            </p>
                            <p className="text-xs text-muted-foreground">Pending</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
