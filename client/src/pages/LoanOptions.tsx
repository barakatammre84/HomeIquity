import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency, formatPercent, getLoanTypeLabel } from "@/lib/authUtils";
import type { LoanApplication, LoanOption } from "@shared/schema";
import {
  CheckCircle2,
  Star,
  Lock,
  TrendingUp,
  Calendar,
  DollarSign,
  Percent,
  FileText,
  ArrowRight,
  Shield,
  Clock,
  AlertCircle,
} from "lucide-react";

interface LoanOptionsData {
  application: LoanApplication;
  options: LoanOption[];
}

export default function LoanOptions() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<LoanOptionsData>({
    queryKey: ["/api/loan-applications", id, "options"],
    enabled: !!id,
  });

  const lockRateMutation = useMutation({
    mutationFn: async (optionId: string) => {
      return await apiRequest("POST", `/api/loan-options/${optionId}/lock`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-applications", id, "options"] });
      toast({
        title: "Rate Locked!",
        description: "Your rate has been locked for 30 days.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to lock rate. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <Skeleton className="mx-auto h-8 w-64" />
            <Skeleton className="mx-auto mt-4 h-4 w-96" />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-96 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-xl font-semibold">Unable to load loan options</h2>
          <p className="mt-2 text-muted-foreground">Please try again later.</p>
          <Link href="/apply">
            <Button className="mt-6">Start New Application</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { application, options } = data;
  const preApprovalAmount = application.preApprovalAmount 
    ? formatCurrency(application.preApprovalAmount) 
    : formatCurrency(application.purchasePrice || "0");

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="bg-gradient-to-b from-primary/5 to-background py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 dark:bg-green-900/30">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                Pre-Approved
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Congratulations! You're pre-approved for
            </h1>
            <p className="mt-4 text-5xl font-bold text-primary" data-testid="text-preapproval-amount">
              {preApprovalAmount}
            </p>
            <p className="mt-4 text-muted-foreground">
              Compare your loan options below and lock in your rate today.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Your Loan Options</h2>
            <p className="text-muted-foreground">
              Based on your profile, here are your best options
            </p>
          </div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
            <Shield className="h-4 w-4" />
            <span>Rates as of today</span>
          </div>
        </div>

        {options.length === 0 ? (
          <Card className="p-12 text-center">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Analyzing Your Application</h3>
            <p className="mt-2 text-muted-foreground">
              Our AI is calculating your best loan options. This usually takes less than a minute.
            </p>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {options.map((option) => (
              <Card
                key={option.id}
                className={`relative overflow-hidden ${
                  option.isRecommended ? "ring-2 ring-primary" : ""
                }`}
                data-testid={`card-loan-option-${option.loanType}`}
              >
                {option.isRecommended && (
                  <div className="absolute right-0 top-0 rounded-bl-lg bg-primary px-3 py-1">
                    <div className="flex items-center gap-1 text-xs font-medium text-primary-foreground">
                      <Star className="h-3 w-3" />
                      Recommended
                    </div>
                  </div>
                )}

                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">
                        {getLoanTypeLabel(option.loanType)}
                      </CardTitle>
                      <CardDescription>
                        {option.loanTerm}-year {parseFloat(option.points || "0") > 0 ? "with points" : "no points"}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {option.loanTerm} yr
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Monthly Payment</p>
                    <p className="text-4xl font-bold" data-testid={`text-monthly-payment-${option.loanType}`}>
                      {formatCurrency(option.monthlyPayment)}
                    </p>
                    <p className="text-xs text-muted-foreground">Principal & Interest</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Rate</span>
                      </div>
                      <p className="text-lg font-semibold">{formatPercent(option.interestRate)}</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">APR</span>
                      </div>
                      <p className="text-lg font-semibold">{formatPercent(option.apr)}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Loan Amount</span>
                      <span className="font-medium">{formatCurrency(option.loanAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Down Payment</span>
                      <span className="font-medium">
                        {formatCurrency(option.downPaymentAmount || "0")} ({option.downPaymentPercent}%)
                      </span>
                    </div>
                    {parseFloat(option.points || "0") > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Points</span>
                        <span className="font-medium">
                          {option.points} ({formatCurrency(option.pointsCost || "0")})
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Closing Costs</span>
                      <span className="font-medium">{formatCurrency(option.closingCosts || "0")}</span>
                    </div>
                    <div className="border-t pt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Cash to Close</span>
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(option.cashToClose || "0")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {option.pmi && parseFloat(option.pmi) > 0 && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-900/20">
                      <p className="text-xs text-yellow-800 dark:text-yellow-200">
                        Includes ${option.pmi}/mo PMI until 20% equity
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    {option.isLocked ? (
                      <Button className="w-full" variant="secondary" disabled>
                        <Lock className="mr-2 h-4 w-4" />
                        Rate Locked
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => lockRateMutation.mutate(option.id)}
                        disabled={lockRateMutation.isPending}
                        data-testid={`button-lock-rate-${option.loanType}`}
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        {lockRateMutation.isPending ? "Locking..." : "Lock This Rate"}
                      </Button>
                    )}
                    <Button variant="outline" className="w-full">
                      <FileText className="mr-2 h-4 w-4" />
                      View Full Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-12 rounded-lg border bg-card p-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div>
              <h3 className="text-lg font-semibold">Ready to proceed?</h3>
              <p className="text-sm text-muted-foreground">
                Lock your rate and upload your documents to complete your application.
              </p>
            </div>
            <Link href="/dashboard">
              <Button className="gap-2" data-testid="button-go-to-dashboard">
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
