import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { preApprovalFormSchema, type PreApprovalFormData } from "@shared/schema";
import { 
  ArrowLeft, 
  ArrowRight, 
  DollarSign, 
  Briefcase, 
  Home, 
  User,
  Clock,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader
} from "lucide-react";

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming"
];

const CREDIT_SCORE_RANGES = [
  { value: "760", label: "Excellent (760+)" },
  { value: "720", label: "Very Good (720-759)" },
  { value: "680", label: "Good (680-719)" },
  { value: "640", label: "Fair (640-679)" },
  { value: "600", label: "Below Average (600-639)" },
  { value: "580", label: "Poor (Below 600)" },
];

const steps = [
  { id: 1, title: "Income", icon: DollarSign, description: "Tell us about your income" },
  { id: 2, title: "Finances", icon: Briefcase, description: "Your financial situation" },
  { id: 3, title: "Property", icon: Home, description: "About the property" },
  { id: 4, title: "Profile", icon: User, description: "A few more details" },
];

export default function PreApproval() {
  const [currentStep, setCurrentStep] = useState(1);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuthSimple();

  const form = useForm<PreApprovalFormData>({
    resolver: zodResolver(preApprovalFormSchema),
    defaultValues: {
      annualIncome: "",
      employmentType: "employed",
      employmentYears: "",
      monthlyDebts: "",
      creditScore: "",
      loanPurpose: "purchase",
      propertyType: "single_family",
      purchasePrice: "",
      downPayment: "",
      isVeteran: false,
      isFirstTimeBuyer: false,
      propertyState: "",
    },
  });

  // Load draft application if user is authenticated
  const { data: draftApp } = useQuery({
    queryKey: ["/api/loan-applications/draft/latest"],
    queryFn: async () => {
      if (!isAuthenticated) return null;
      const response = await apiRequest("GET", "/api/loan-applications/draft/latest");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // Initialize with draft data if available
  useEffect(() => {
    if (draftApp) {
      setApplicationId(draftApp.id);
      const formData: any = {};
      
      if (draftApp.annualIncome) formData.annualIncome = String(draftApp.annualIncome);
      if (draftApp.employmentType) formData.employmentType = draftApp.employmentType;
      if (draftApp.employmentYears) formData.employmentYears = String(draftApp.employmentYears);
      if (draftApp.monthlyDebts) formData.monthlyDebts = String(draftApp.monthlyDebts);
      if (draftApp.creditScore) formData.creditScore = String(draftApp.creditScore);
      if (draftApp.loanPurpose) formData.loanPurpose = draftApp.loanPurpose;
      if (draftApp.propertyType) formData.propertyType = draftApp.propertyType;
      if (draftApp.purchasePrice) formData.purchasePrice = String(draftApp.purchasePrice);
      if (draftApp.downPayment) formData.downPayment = String(draftApp.downPayment);
      formData.isVeteran = draftApp.isVeteran || false;
      formData.isFirstTimeBuyer = draftApp.isFirstTimeBuyer || false;
      if (draftApp.propertyState) formData.propertyState = draftApp.propertyState;

      form.reset(formData);
    }
  }, [draftApp, form]);

  // Create application mutation
  const createAppMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/loan-applications", {
        ...form.getValues(),
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setApplicationId(data.id);
    },
    onError: (error: Error) => {
      console.error("Failed to create application:", error);
    },
  });

  // Save draft mutation (for auto-save after each step)
  const saveDraftMutation = useMutation({
    mutationFn: async (data: Partial<PreApprovalFormData>) => {
      if (!applicationId) return null;
      const response = await apiRequest("PATCH", `/api/loan-applications/${applicationId}`, data);
      return response.json();
    },
    onError: (error: Error) => {
      console.error("Failed to save draft:", error);
    },
  });

  // Final submission mutation
  const submitMutation = useMutation({
    mutationFn: async (data: PreApprovalFormData) => {
      const response = await apiRequest("POST", "/api/loan-applications", data);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-applications"] });
      toast({
        title: "Application Submitted!",
        description: "Analyzing your information...",
      });
      navigate(`/loan-options/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit application",
        variant: "destructive",
      });
    },
  });

  const progress = (currentStep / steps.length) * 100;

  const getFieldsForStep = (step: number): (keyof PreApprovalFormData)[] => {
    switch (step) {
      case 1:
        return ["annualIncome", "employmentType", "employmentYears"];
      case 2:
        return ["monthlyDebts", "creditScore"];
      case 3:
        return ["loanPurpose", "propertyType", "purchasePrice", "downPayment"];
      case 4:
        return ["isVeteran", "isFirstTimeBuyer", "propertyState"];
      default:
        return [];
    }
  };

  const nextStep = async () => {
    const fieldsToValidate = getFieldsForStep(currentStep);
    const isValid = await form.trigger(fieldsToValidate as any);
    
    if (isValid) {
      // Auto-save the current step if there's an application ID
      if (isAuthenticated && applicationId) {
        setIsSaving(true);
        const stepData: any = {};
        fieldsToValidate.forEach((field) => {
          stepData[field] = form.getValues(field);
        });
        
        await saveDraftMutation.mutateAsync(stepData);
        setIsSaving(false);
      } else if (isAuthenticated && !applicationId) {
        // Create application on first step
        const app = await createAppMutation.mutateAsync();
        if (app) {
          setApplicationId(app.id);
        }
      }

      if (currentStep < steps.length) {
        setCurrentStep(currentStep + 1);
      } else {
        form.handleSubmit((data) => submitMutation.mutate(data))();
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5">
            <Clock className="h-4 w-4 text-green-700" />
            <span className="text-sm font-medium text-green-900">3-minute pre-approval</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-gray-900">
            Get Pre-Approved
          </h1>
          <p className="mt-2 text-muted-foreground">
            Answer a few questions to see your loan options
          </p>
          {isAuthenticated && applicationId && (
            <p className="mt-2 flex items-center justify-center gap-2 text-xs text-green-700">
              <CheckCircle2 className="h-3 w-3" />
              Your progress is being saved automatically
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress value={progress} className="h-2 bg-gray-200" />
          <div className="mt-4 flex justify-between">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex flex-col items-center ${
                  step.id === currentStep
                    ? "text-green-700"
                    : step.id < currentStep
                    ? "text-gray-500"
                    : "text-gray-300"
                }`}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-medium ${
                    step.id === currentStep
                      ? "border-green-700 bg-green-700 text-white"
                      : step.id < currentStep
                      ? "border-green-700 bg-green-100 text-green-700"
                      : "border-gray-300 bg-gray-100 text-gray-400"
                  }`}
                >
                  {step.id < currentStep ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span className="mt-2 hidden text-xs font-medium sm:block">
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Card className="border-gray-200">
          <CardHeader className="bg-gradient-to-r from-green-50 to-green-50 border-b">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              {(() => {
                const StepIcon = steps[currentStep - 1].icon;
                return <StepIcon className="h-5 w-5 text-green-700" />;
              })()}
              {steps[currentStep - 1].title}
            </CardTitle>
            <CardDescription>{steps[currentStep - 1].description}</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form className="space-y-6">
                {currentStep === 1 && (
                  <>
                    <FormField
                      control={form.control}
                      name="annualIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-900">Annual Gross Income</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                              <Input
                                placeholder="100,000"
                                className="pl-10 border-gray-300"
                                data-testid="input-annual-income"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="employmentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-900">Employment Type</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="grid grid-cols-2 gap-4"
                            >
                              {[
                                { value: "employed", label: "Employed" },
                                { value: "self_employed", label: "Self-Employed" },
                                { value: "retired", label: "Retired" },
                                { value: "other", label: "Other" },
                              ].map((option) => (
                                <div key={option.value}>
                                  <RadioGroupItem
                                    value={option.value}
                                    id={option.value}
                                    className="peer sr-only"
                                  />
                                  <Label
                                    htmlFor={option.value}
                                    className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-gray-200 bg-white p-4 hover:bg-gray-50 peer-data-[state=checked]:border-green-700 peer-data-[state=checked]:bg-green-50 [&:has([data-state=checked])]:border-green-700"
                                  >
                                    {option.label}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="employmentYears"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-900">Years at Current Job</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="5"
                              className="border-gray-300"
                              data-testid="input-employment-years"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {currentStep === 2 && (
                  <>
                    <FormField
                      control={form.control}
                      name="monthlyDebts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-900">Total Monthly Debt Payments</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                              <Input
                                placeholder="2,000"
                                className="pl-10 border-gray-300"
                                data-testid="input-monthly-debts"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <p className="text-xs text-gray-500">
                            Include car payments, student loans, credit cards, etc.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="creditScore"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-900">Estimated Credit Score</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="border-gray-300" data-testid="select-credit-score">
                                <SelectValue placeholder="Select your credit score range" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CREDIT_SCORE_RANGES.map((range) => (
                                <SelectItem key={range.value} value={range.value}>
                                  {range.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {currentStep === 3 && (
                  <>
                    <FormField
                      control={form.control}
                      name="loanPurpose"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-900">Loan Purpose</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="grid grid-cols-3 gap-4"
                            >
                              {[
                                { value: "purchase", label: "Purchase" },
                                { value: "refinance", label: "Refinance" },
                                { value: "cash_out", label: "Cash-Out" },
                              ].map((option) => (
                                <div key={option.value}>
                                  <RadioGroupItem
                                    value={option.value}
                                    id={`purpose-${option.value}`}
                                    className="peer sr-only"
                                  />
                                  <Label
                                    htmlFor={`purpose-${option.value}`}
                                    className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-gray-200 bg-white p-4 hover:bg-gray-50 peer-data-[state=checked]:border-green-700 peer-data-[state=checked]:bg-green-50 [&:has([data-state=checked])]:border-green-700"
                                  >
                                    {option.label}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="propertyType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-900">Property Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="border-gray-300" data-testid="select-property-type">
                                <SelectValue placeholder="Select property type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="single_family">Single Family Home</SelectItem>
                              <SelectItem value="condo">Condominium</SelectItem>
                              <SelectItem value="townhouse">Townhouse</SelectItem>
                              <SelectItem value="multi_family">Multi-Family (2-4 units)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="purchasePrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-900">Purchase Price</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                  placeholder="500,000"
                                  className="pl-10 border-gray-300"
                                  data-testid="input-purchase-price"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="downPayment"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-gray-900">Down Payment</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                <Input
                                  placeholder="100,000"
                                  className="pl-10 border-gray-300"
                                  data-testid="input-down-payment"
                                  {...field}
                                />
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}

                {currentStep === 4 && (
                  <>
                    <FormField
                      control={form.control}
                      name="propertyState"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-900">Property Location (State)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="border-gray-300" data-testid="select-property-state">
                                <SelectValue placeholder="Select state" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {US_STATES.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isVeteran"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border border-gray-200 bg-gray-50 p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-veteran"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="cursor-pointer text-gray-900">
                              I am a veteran or active military
                            </FormLabel>
                            <p className="text-sm text-gray-600">
                              VA loans offer 0% down payment and no PMI
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isFirstTimeBuyer"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border border-gray-200 bg-gray-50 p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-first-time"
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel className="cursor-pointer text-gray-900">
                              I am a first-time homebuyer
                            </FormLabel>
                            <p className="text-sm text-gray-600">
                              You may qualify for special programs with lower down payments
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />

                    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Shield className="h-4 w-4 text-green-700" />
                        <span className="font-medium text-green-900">Your information is secure</span>
                      </div>
                      <p className="mt-1 text-xs text-green-800">
                        We use bank-level encryption to protect your data. This is a soft credit check that won't affect your credit score.
                      </p>
                    </div>
                  </>
                )}

                <div className="flex justify-between gap-4 pt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 1}
                    data-testid="button-prev-step"
                    className="border-gray-300"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  
                  <Button
                    type="button"
                    onClick={nextStep}
                    disabled={submitMutation.isPending || saveDraftMutation.isPending || isSaving}
                    data-testid="button-next-step"
                    className="gap-2 bg-green-700 hover:bg-green-800"
                  >
                    {submitMutation.isPending ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : isSaving ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : currentStep === steps.length ? (
                      <>
                        Get My Results
                        <ArrowRight className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-amber-700" />
            <span className="text-sm font-medium text-amber-900">Soft Credit Inquiry</span>
          </div>
          <p className="text-xs text-amber-800">
            This pre-approval inquiry will not affect your credit score. By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

// Simple hook for checking authentication
function useAuthSimple() {
  const { data: user } = useQuery({
    queryKey: ["/api/user"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/user", { credentials: "include" });
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
  });

  return {
    isAuthenticated: !!user,
  };
}
