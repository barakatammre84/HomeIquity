import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePageView, useTrackActivity } from "@/hooks/useActivityTracker";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ConversionCTA } from "@/components/ConversionCTA";
import {
  Home,
  DollarSign,
  TrendingUp,
  Calculator,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Percent,
  Wallet,
  CreditCard,
  Briefcase,
} from "lucide-react";

interface AffordabilityInputs {
  annualIncome: number;
  monthlyDebts: number;
  downPaymentSaved: number;
  creditScore: number;
  interestRate: number;
  propertyTaxRate: number;
  insuranceRate: number;
  hoaMonthly: number;
  loanTermYears: number;
}

interface AffordabilityResults {
  maxHomePrice: number;
  maxMonthlyPayment: number;
  frontEndDTI: number;
  backEndDTI: number;
  comfortablePrice: number;
  stretchPrice: number;
  requiredDownPayment: number;
  monthlyPITI: number;
  withinGuidelines: boolean;
}

const defaultInputs: AffordabilityInputs = {
  annualIncome: 100000,
  monthlyDebts: 500,
  downPaymentSaved: 50000,
  creditScore: 680,
  interestRate: 6.5,
  propertyTaxRate: 1.2,
  insuranceRate: 0.5,
  hoaMonthly: 0,
  loanTermYears: 30,
};

function calculateAffordability(inputs: AffordabilityInputs): AffordabilityResults {
  const {
    annualIncome,
    monthlyDebts,
    downPaymentSaved,
    creditScore,
    interestRate,
    propertyTaxRate,
    insuranceRate,
    hoaMonthly,
    loanTermYears,
  } = inputs;

  const monthlyIncome = annualIncome / 12;
  
  const maxFrontEndDTI = 0.28;
  const maxBackEndDTI = creditScore >= 740 ? 0.45 : creditScore >= 700 ? 0.43 : 0.41;

  const maxHousingPayment = monthlyIncome * maxFrontEndDTI;
  const maxTotalPayment = monthlyIncome * maxBackEndDTI - monthlyDebts;
  const maxMonthlyPayment = Math.min(maxHousingPayment, maxTotalPayment);

  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTermYears * 12;

  const monthlyTaxInsuranceRate = (propertyTaxRate + insuranceRate) / 100 / 12;
  
  const availableForPI = maxMonthlyPayment - hoaMonthly;
  
  let maxLoanAmount = 0;
  if (monthlyRate > 0) {
    const factor = (Math.pow(1 + monthlyRate, numPayments) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, numPayments));
    maxLoanAmount = (availableForPI / (1 + monthlyTaxInsuranceRate * factor)) * factor;
  } else {
    maxLoanAmount = availableForPI * numPayments / (1 + monthlyTaxInsuranceRate * numPayments);
  }

  const minDownPaymentPercent = creditScore >= 740 ? 0.03 : creditScore >= 680 ? 0.05 : 0.10;
  
  let maxHomePrice = maxLoanAmount / (1 - minDownPaymentPercent);
  
  const maxFromDownPayment = downPaymentSaved / minDownPaymentPercent;
  maxHomePrice = Math.min(maxHomePrice, maxFromDownPayment);

  const comfortablePrice = maxHomePrice * 0.85;
  const stretchPrice = maxHomePrice * 1.1;

  const requiredDownPayment = maxHomePrice * minDownPaymentPercent;
  
  const loanAmount = maxHomePrice - requiredDownPayment;
  const monthlyPI = monthlyRate > 0
    ? (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
      (Math.pow(1 + monthlyRate, numPayments) - 1)
    : loanAmount / numPayments;
  
  const monthlyTax = (maxHomePrice * propertyTaxRate / 100) / 12;
  const monthlyInsurance = (maxHomePrice * insuranceRate / 100) / 12;
  const monthlyPITI = monthlyPI + monthlyTax + monthlyInsurance + hoaMonthly;

  const frontEndDTI = (monthlyPITI / monthlyIncome) * 100;
  const backEndDTI = ((monthlyPITI + monthlyDebts) / monthlyIncome) * 100;

  const withinGuidelines = frontEndDTI <= 28 && backEndDTI <= maxBackEndDTI * 100;

  return {
    maxHomePrice: Math.max(0, maxHomePrice),
    maxMonthlyPayment: Math.max(0, maxMonthlyPayment),
    frontEndDTI,
    backEndDTI,
    comfortablePrice: Math.max(0, comfortablePrice),
    stretchPrice: Math.max(0, stretchPrice),
    requiredDownPayment: Math.max(0, requiredDownPayment),
    monthlyPITI: Math.max(0, monthlyPITI),
    withinGuidelines,
  };
}

export default function AffordabilityCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [inputs, setInputs] = useState<AffordabilityInputs>(defaultInputs);

  usePageView("/calculators/affordability");
  const trackActivity = useTrackActivity();
  const trackedRef = useRef(false);

  const results = useMemo(() => calculateAffordability(inputs), [inputs]);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackActivity("calculator_use", "/calculators/affordability", { type: "affordability" });
    }
  }, [trackActivity]);

  const saveResultsMutation = useMutation({
    mutationFn: async (data: { inputs: AffordabilityInputs; results: AffordabilityResults }) => {
      return apiRequest("POST", "/api/calculator-results", {
        calculatorType: "affordability",
        inputs: data.inputs,
        results: data.results,
      });
    },
    onSuccess: () => {
      toast({
        title: "Results Saved",
        description: "Your affordability analysis has been saved to your profile.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/calculator-results"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save results. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleStartPreApproval = () => {
    if (user) {
      saveResultsMutation.mutate({ inputs, results });
    }
    navigate("/apply");
  };

  const updateInput = (field: keyof AffordabilityInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const getDTIColor = (dti: number) => {
    if (dti <= 28) return "text-green-600";
    if (dti <= 36) return "text-yellow-600";
    return "text-red-600";
  };

  const getDTILabel = (dti: number) => {
    if (dti <= 28) return "Under 28%";
    if (dti <= 36) return "28-36%";
    if (dti <= 43) return "36-43%";
    return "Above 43%";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            How Much Home Can You Afford?
          </h1>
          <p className="mt-2 text-muted-foreground">
            Calculate your maximum home price based on your income and financial situation
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Income & Employment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="annualIncome">Annual Gross Income</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="annualIncome"
                      type="number"
                      value={inputs.annualIncome}
                      onChange={(e) => updateInput("annualIncome", Number(e.target.value))}
                      className="pl-9"
                      data-testid="input-annual-income"
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Monthly: {formatCurrency(inputs.annualIncome / 12)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Debts & Credit
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="monthlyDebts">Monthly Debt Payments</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="monthlyDebts"
                      type="number"
                      value={inputs.monthlyDebts}
                      onChange={(e) => updateInput("monthlyDebts", Number(e.target.value))}
                      className="pl-9"
                      data-testid="input-monthly-debts"
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Include car loans, student loans, credit cards, etc.
                  </p>
                </div>
                <div>
                  <Label>Credit Score: {inputs.creditScore}</Label>
                  <Slider
                    value={[inputs.creditScore]}
                    onValueChange={([v]) => updateInput("creditScore", v)}
                    min={580}
                    max={850}
                    step={10}
                    className="mt-2"
                    data-testid="slider-credit-score"
                  />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>580</span>
                    <span>700</span>
                    <span>850</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Down Payment & Loan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="downPaymentSaved">Down Payment Saved</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="downPaymentSaved"
                      type="number"
                      value={inputs.downPaymentSaved}
                      onChange={(e) => updateInput("downPaymentSaved", Number(e.target.value))}
                      className="pl-9"
                      data-testid="input-down-payment"
                    />
                  </div>
                </div>
                <div>
                  <Label>Interest Rate: {inputs.interestRate}%</Label>
                  <Slider
                    value={[inputs.interestRate]}
                    onValueChange={([v]) => updateInput("interestRate", v)}
                    min={3}
                    max={10}
                    step={0.125}
                    className="mt-2"
                    data-testid="slider-interest-rate"
                  />
                </div>
                <div>
                  <Label>Loan Term</Label>
                  <Select
                    value={String(inputs.loanTermYears)}
                    onValueChange={(v) => updateInput("loanTermYears", Number(v))}
                  >
                    <SelectTrigger data-testid="select-loan-term">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 Years</SelectItem>
                      <SelectItem value="20">20 Years</SelectItem>
                      <SelectItem value="30">30 Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="hoaMonthly">Monthly HOA Fees (Optional)</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="hoaMonthly"
                      type="number"
                      value={inputs.hoaMonthly}
                      onChange={(e) => updateInput("hoaMonthly", Number(e.target.value))}
                      className="pl-9"
                      data-testid="input-hoa"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-2 border-primary bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Your Maximum Home Price
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary" data-testid="text-max-price">
                    {formatCurrency(results.maxHomePrice)}
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    Based on your income and financial profile
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Price Ranges</CardTitle>
                <CardDescription>Based on your qualifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-green-50 p-4 dark:bg-green-950">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Comfortable</span>
                    </div>
                    <span className="text-lg font-bold text-green-600" data-testid="text-comfortable-price">
                      {formatCurrency(results.comfortablePrice)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Room in budget for savings and lifestyle
                  </p>
                </div>
                <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <span className="font-medium">Stretch</span>
                    </div>
                    <span className="text-lg font-bold text-yellow-600" data-testid="text-stretch-price">
                      {formatCurrency(results.stretchPrice)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tighter budget, less flexibility
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Payment Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Estimated PITI</span>
                    <span className="font-bold" data-testid="text-monthly-piti">
                      {formatCurrency(results.monthlyPITI)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Required Down Payment</span>
                    <span>{formatCurrency(results.requiredDownPayment)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Debt-to-Income Ratios</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Housing Ratio (Front-End)</span>
                    <span className={`font-medium ${getDTIColor(results.frontEndDTI)}`}>
                      {results.frontEndDTI.toFixed(1)}% - {getDTILabel(results.frontEndDTI)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(results.frontEndDTI, 50)}
                    max={50}
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Target: 28% or less</p>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Total DTI (Back-End)</span>
                    <span className={`font-medium ${getDTIColor(results.backEndDTI)}`}>
                      {results.backEndDTI.toFixed(1)}% - {getDTILabel(results.backEndDTI)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(results.backEndDTI, 50)}
                    max={50}
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Target: 43% or less</p>
                </div>
              </CardContent>
            </Card>

            <Button
              size="lg"
              className="w-full"
              onClick={handleStartPreApproval}
              data-testid="button-start-preapproval"
            >
              Start Pre-Approval Application
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            {user && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => saveResultsMutation.mutate({ inputs, results })}
                disabled={saveResultsMutation.isPending}
                data-testid="button-save-results"
              >
                Save Results to My Profile
              </Button>
            )}

            <ConversionCTA context="calculator" purchasePrice={String(results.maxHomePrice)} />
          </div>
        </div>
      </div>
    </div>
  );
}
