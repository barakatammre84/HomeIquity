import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { preApprovalFormSchema, type PreApprovalFormData } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { 
  ArrowRight, 
  ChevronLeft, 
  DollarSign, 
  Home,
  Briefcase,
  Building2,
  TrendingUp,
  Clock,
  CreditCard,
  MapPin,
  Shield,
  Users,
  Loader2,
  Check
} from "lucide-react";

const US_STATES = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" }, { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" }, { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" }, { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" }, { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" }, { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" }, { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" }, { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" }, { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" }, { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" }, { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" }, { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" }, { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" }, { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" }, { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" }, { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" }, { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" }
];

type QuestionType = "intro" | "choice" | "currency" | "number" | "state" | "boolean_pair" | "final";

interface QuestionOption {
  value: string;
  label: string;
  icon?: typeof Home;
}

interface Question {
  id: string;
  field?: keyof PreApprovalFormData;
  type: QuestionType;
  question?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  options?: QuestionOption[];
  placeholder?: string;
  subtext?: string;
  icon?: typeof Home;
  booleanFields?: { field: keyof PreApprovalFormData; label: string; icon: typeof Home }[];
}

const QUESTIONS: Question[] = [
  {
    id: "intro",
    type: "intro",
    title: "Let's get you home.",
    subtitle: "We'll get you a verified pre-approval letter in about 3 minutes. No impact to your credit score.",
    buttonText: "Start My Pre-Approval"
  },
  {
    id: "loanPurpose",
    field: "loanPurpose",
    type: "choice",
    question: "First things first, what is your goal?",
    icon: Home,
    options: [
      { value: "purchase", label: "Buying a Home", icon: Home },
      { value: "refinance", label: "Refinancing My Home", icon: TrendingUp },
      { value: "cash_out", label: "Cash-Out Refinance", icon: DollarSign }
    ]
  },
  {
    id: "propertyType",
    field: "propertyType",
    type: "choice",
    question: "What kind of property are we looking at?",
    icon: Building2,
    options: [
      { value: "single_family", label: "Single Family Home", icon: Home },
      { value: "condo", label: "Condo", icon: Building2 },
      { value: "townhouse", label: "Townhouse", icon: Building2 },
      { value: "multi_family", label: "Multi-Family (2-4 Units)", icon: Users }
    ]
  },
  {
    id: "purchasePrice",
    field: "purchasePrice",
    type: "currency",
    question: "What is the estimated purchase price?",
    placeholder: "500,000",
    subtext: "It's okay to estimate if you haven't found 'the one' yet.",
    icon: DollarSign
  },
  {
    id: "downPayment",
    field: "downPayment",
    type: "currency",
    question: "How much are you planning to put down?",
    placeholder: "100,000",
    subtext: "We can adjust this later to fine-tune your monthly payment.",
    icon: DollarSign
  },
  {
    id: "propertyState",
    field: "propertyState",
    type: "state",
    question: "Which state are you looking to buy in?",
    icon: MapPin,
    subtext: "Select from the list below"
  },
  {
    id: "annualIncome",
    field: "annualIncome",
    type: "currency",
    question: "What is your total annual household income?",
    placeholder: "120,000",
    subtext: "Gross income before taxes. Include salary, bonuses, etc.",
    icon: Briefcase
  },
  {
    id: "employmentType",
    field: "employmentType",
    type: "choice",
    question: "How are you employed?",
    icon: Briefcase,
    options: [
      { value: "employed", label: "W-2 Employee", icon: Briefcase },
      { value: "self_employed", label: "Self-Employed / 1099", icon: Users },
      { value: "retired", label: "Retired", icon: Clock },
      { value: "other", label: "Other", icon: Users }
    ]
  },
  {
    id: "employmentYears",
    field: "employmentYears",
    type: "number",
    question: "How many years have you been at your current job?",
    placeholder: "5",
    subtext: "Round to the nearest year",
    icon: Clock
  },
  {
    id: "monthlyDebts",
    field: "monthlyDebts",
    type: "currency",
    question: "What are your total monthly debt payments?",
    placeholder: "1,500",
    subtext: "Include car loans, credit cards, student loans, etc. (not rent/mortgage)",
    icon: CreditCard
  },
  {
    id: "creditScore",
    field: "creditScore",
    type: "choice",
    question: "Roughly, what is your credit score?",
    icon: CreditCard,
    options: [
      { value: "760", label: "Excellent (760+)", icon: Check },
      { value: "720", label: "Very Good (720-759)", icon: Check },
      { value: "680", label: "Good (680-719)", icon: Check },
      { value: "640", label: "Fair (640-679)", icon: Check },
      { value: "600", label: "Below Average (Below 640)", icon: Check }
    ]
  },
  {
    id: "veteranAndFirstTime",
    type: "boolean_pair",
    question: "A couple more questions about you",
    icon: Shield,
    booleanFields: [
      { field: "isVeteran", label: "I am a U.S. military veteran or active duty", icon: Shield },
      { field: "isFirstTimeBuyer", label: "I am a first-time home buyer", icon: Home }
    ]
  },
  {
    id: "final",
    type: "final",
    question: "You're almost there!",
    subtitle: "Click submit to get your personalized loan options. This will not affect your credit score."
  }
];

export default function PreApproval() {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();

  const form = useForm<PreApprovalFormData>({
    resolver: zodResolver(preApprovalFormSchema),
    mode: "onChange",
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

  const currentQ = QUESTIONS[currentStep];

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
      const formData: Partial<PreApprovalFormData> = {};
      
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

      form.reset(formData as PreApprovalFormData);
    }
  }, [draftApp, form]);

  // Create/update application mutation
  const submitMutation = useMutation({
    mutationFn: async (data: PreApprovalFormData) => {
      const payload = {
        ...data,
        annualIncome: data.annualIncome.replace(/,/g, ""),
        purchasePrice: data.purchasePrice.replace(/,/g, ""),
        downPayment: data.downPayment.replace(/,/g, ""),
        monthlyDebts: data.monthlyDebts.replace(/,/g, ""),
      };

      if (applicationId) {
        const response = await apiRequest("PATCH", `/api/loan-applications/${applicationId}`, payload);
        return response.json();
      } else {
        const response = await apiRequest("POST", "/api/loan-applications", payload);
        return response.json();
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/loan-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({
        title: "Pre-Approval Complete!",
        description: "Analyzing your profile with AI...",
      });
      navigate(`/loan-options/${result.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleNext = async () => {
    if (currentQ.type === "intro") {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
      return;
    }

    if (currentQ.type === "final") {
      const isValid = await form.trigger();
      if (isValid) {
        submitMutation.mutate(form.getValues());
      } else {
        toast({ 
          title: "Please complete all fields", 
          description: "Some required information is missing.",
          variant: "destructive" 
        });
      }
      return;
    }

    if (currentQ.type === "boolean_pair") {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
      return;
    }

    // Validate ONLY the current field before moving forward
    if (currentQ.field) {
      const isValid = await form.trigger(currentQ.field);
      if (isValid) {
        setDirection(1);
        setCurrentStep((prev) => prev + 1);
      } else {
        toast({ 
          title: "Please fill out this field", 
          variant: "destructive" 
        });
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && currentQ.type !== "choice" && currentQ.type !== "state") {
      e.preventDefault();
      handleNext();
    }
  };

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const renderInput = () => {
    const IconComponent = currentQ.icon;

    switch (currentQ.type) {
      case "currency": {
        const fieldName = currentQ.field as keyof PreApprovalFormData;
        const watchedValue = form.watch(fieldName);
        const displayValue = typeof watchedValue === 'string' ? watchedValue : "";
        return (
          <div className="relative w-full max-w-md mx-auto">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 text-primary" />
            <Input
              key={`currency-${fieldName}`}
              autoFocus
              data-testid={`input-${currentQ.field}`}
              value={displayValue}
              onChange={(e) => {
                const formatted = formatCurrency(e.target.value);
                form.setValue(fieldName, formatted as never, { shouldValidate: true, shouldDirty: true });
              }}
              className="pl-16 h-20 text-4xl border-0 border-b-2 border-muted rounded-none focus-visible:ring-0 focus-visible:border-primary bg-transparent placeholder:text-muted-foreground/40"
              placeholder={currentQ.placeholder}
              onKeyDown={handleKeyDown}
            />
          </div>
        );
      }

      case "number": {
        const fieldName = currentQ.field as keyof PreApprovalFormData;
        const watchedValue = form.watch(fieldName);
        const displayValue = typeof watchedValue === 'string' ? watchedValue : "";
        return (
          <div className="relative w-full max-w-md mx-auto">
            {IconComponent && <IconComponent className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 text-primary" />}
            <Input
              key={`number-${fieldName}`}
              autoFocus
              data-testid={`input-${currentQ.field}`}
              type="text"
              inputMode="numeric"
              value={displayValue}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                form.setValue(fieldName, value as never, { shouldValidate: true, shouldDirty: true });
              }}
              className="pl-16 h-20 text-4xl border-0 border-b-2 border-muted rounded-none focus-visible:ring-0 focus-visible:border-primary bg-transparent placeholder:text-muted-foreground/40"
              placeholder={currentQ.placeholder}
              onKeyDown={handleKeyDown}
            />
          </div>
        );
      }

      case "choice":
        return (
          <div className="grid gap-3 w-full max-w-lg mx-auto">
            {currentQ.options?.map((option) => {
              const OptionIcon = option.icon;
              const isSelected = form.watch(currentQ.field as keyof PreApprovalFormData) === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  data-testid={`option-${currentQ.field}-${option.value}`}
                  onClick={() => {
                    form.setValue(currentQ.field as keyof PreApprovalFormData, option.value as never);
                    setTimeout(() => {
                      setDirection(1);
                      setCurrentStep((prev) => prev + 1);
                    }, 200);
                  }}
                  className={`flex items-center gap-4 p-5 text-left text-lg font-medium border-2 rounded-xl transition-all duration-200 group
                    ${isSelected 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover:border-primary/50 hover:bg-muted/50"
                    }`}
                >
                  {OptionIcon && (
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors
                      ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"}`}>
                      <OptionIcon className="h-5 w-5" />
                    </div>
                  )}
                  <span className={`flex-1 ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {option.label}
                  </span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                    ${isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                    {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        );

      case "state":
        const selectedState = form.watch("propertyState");
        return (
          <div className="w-full max-w-lg mx-auto">
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {US_STATES.map((state) => (
                <button
                  key={state.value}
                  type="button"
                  data-testid={`option-state-${state.value}`}
                  onClick={() => {
                    form.setValue("propertyState", state.value, { shouldValidate: true });
                    setTimeout(() => {
                      setDirection(1);
                      setCurrentStep((prev) => prev + 1);
                    }, 200);
                  }}
                  className={`p-3 text-center font-medium border-2 rounded-lg transition-all duration-150
                    ${selectedState === state.value 
                      ? "border-primary bg-primary text-primary-foreground" 
                      : "border-muted hover:border-primary/50 hover:bg-muted/50"
                    }`}
                >
                  {state.value}
                </button>
              ))}
            </div>
          </div>
        );

      case "boolean_pair":
        return (
          <div className="grid gap-4 w-full max-w-lg mx-auto">
            {currentQ.booleanFields?.map((field) => {
              const FieldIcon = field.icon;
              const isChecked = form.watch(field.field) as boolean;
              return (
                <button
                  key={field.field}
                  type="button"
                  data-testid={`toggle-${field.field}`}
                  onClick={() => {
                    form.setValue(field.field, !isChecked as never);
                  }}
                  className={`flex items-center gap-4 p-5 text-left text-lg font-medium border-2 rounded-xl transition-all duration-200
                    ${isChecked 
                      ? "border-primary bg-primary/5" 
                      : "border-muted hover:border-primary/50"
                    }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors
                    ${isChecked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <FieldIcon className="h-5 w-5" />
                  </div>
                  <span className={`flex-1 ${isChecked ? "text-primary" : "text-foreground"}`}>
                    {field.label}
                  </span>
                  <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors
                    ${isChecked ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                    {isChecked && <Check className="w-4 h-4 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        );
        
      default:
        return null;
    }
  };

  // Intro Screen
  if (currentQ.type === "intro") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl"
        >
          <div className="mb-8 flex justify-center">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Home className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 
            className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-6"
            data-testid="text-intro-title"
          >
            {currentQ.title}
          </h1>
          <p className="text-xl text-muted-foreground mb-12">{currentQ.subtitle}</p>
          <Button 
            onClick={handleNext} 
            size="lg" 
            className="text-lg px-8 py-6 h-auto rounded-full"
            data-testid="button-start-preapproval"
          >
            {currentQ.buttonText} <ArrowRight className="ml-2" />
          </Button>
          <p className="mt-8 text-sm text-muted-foreground">
            Already have an account?{" "}
            <a href="/api/login" className="text-primary hover:underline">
              Sign in
            </a>
          </p>
        </motion.div>
      </div>
    );
  }

  // The Conversational Form Steps
  return (
    <div className="min-h-screen flex flex-col bg-background overflow-hidden">
      
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-muted z-50">
        <motion.div 
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${(currentStep / (QUESTIONS.length - 1)) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>

      {/* Navigation Header */}
      <div className="fixed top-0 w-full p-4 sm:p-6 flex justify-between items-center z-40 bg-background/80 backdrop-blur-sm">
        <button 
          onClick={handleBack}
          disabled={currentStep === 0}
          className={`p-2 rounded-full hover:bg-muted transition-all ${currentStep === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          data-testid="button-back"
        >
          <ChevronLeft className="w-6 h-6 text-muted-foreground" />
        </button>
        <span className="text-sm font-medium text-muted-foreground" data-testid="text-step-counter">
          Step {currentStep} of {QUESTIONS.length - 1}
        </span>
        <div className="w-10" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 pt-20 w-full max-w-4xl mx-auto relative">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            initial={{ x: direction * 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -50, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full text-center"
          >
            {/* Question Title */}
            <h2 
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-4 leading-tight"
              data-testid="text-question"
            >
              {currentQ.question}
            </h2>
            
            {currentQ.subtitle && (
              <p className="text-lg text-muted-foreground mb-8">{currentQ.subtitle}</p>
            )}

            {currentQ.subtext && (
               <p className="text-base text-muted-foreground/70 mb-8 max-w-lg mx-auto">{currentQ.subtext}</p>
            )}

            {/* Input Area */}
            <div className="mb-10">
              {renderInput()}
            </div>

            {/* Continue Button (for non-choice inputs) */}
            {(currentQ.type === "currency" || currentQ.type === "number" || currentQ.type === "boolean_pair" || currentQ.type === "final") && (
              <Button 
                onClick={handleNext} 
                size="lg" 
                disabled={submitMutation.isPending}
                className="text-lg px-10 py-6 h-auto rounded-full shadow-lg hover:shadow-xl transition-all"
                data-testid={currentQ.type === "final" ? "button-submit" : "button-continue"}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : currentQ.type === "final" ? (
                  "Get My Loan Options"
                ) : (
                  <>
                    Continue
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-4 sm:p-6 text-center border-t border-muted">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4" />
          <span>Soft credit check only - won't affect your credit score</span>
        </div>
      </div>
    </div>
  );
}
