import { useState, type KeyboardEvent } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  MapPin, 
  ChevronDown, 
  Clock,
  DollarSign,
  Home,
  Building2,
  CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";

export type LoanType = "purchase" | "refinance" | "cashout" | "heloc" | "va";

type TabCategory = "mortgage" | "home-equity";

const loanTypeToTab: Record<LoanType, TabCategory> = {
  purchase: "mortgage",
  refinance: "mortgage",
  cashout: "mortgage",
  va: "mortgage",
  heloc: "home-equity",
};

interface RatePageHeaderProps {
  loanType: LoanType;
  title: string;
  description?: string;
  zipcode: string;
  onZipcodeChange: (zipcode: string) => void;
  onSearch: () => void;
  showCashOutAmount?: boolean;
  showPropertyValue?: boolean;
  showMortgageBalance?: boolean;
  showDownPayment?: boolean;
  showLoanAmount?: boolean;
  showCreditScore?: boolean;
  showPropertyType?: boolean;
  showAdvancedInputs?: boolean;
}

const loanTypeLabels: Record<LoanType, string> = {
  purchase: "Purchase mortgage rates today",
  refinance: "Refinance rates today",
  cashout: "Cash-out refinance rates today",
  heloc: "HELOC rates today",
  va: "VA loan rates today",
};

const loanTypeDescriptions: Record<LoanType, string> = {
  purchase: "Here are today's purchase mortgage rates",
  refinance: "Here are today's refinance rates",
  cashout: "Here are today's cash-out refinance rates",
  heloc: "Here are today's home equity line of credit rates",
  va: "Here are today's VA loan rates for veterans and service members",
};

export default function RatePageHeader({
  loanType,
  title,
  description,
  zipcode,
  onZipcodeChange,
  onSearch,
  showCashOutAmount = false,
  showPropertyValue = true,
  showMortgageBalance = false,
  showDownPayment = false,
  showLoanAmount = false,
  showCreditScore = false,
  showPropertyType = false,
  showAdvancedInputs = true,
}: RatePageHeaderProps) {
  const [cashOutAmount, setCashOutAmount] = useState("50000");
  const [propertyValue, setPropertyValue] = useState("350000");
  const [mortgageBalance, setMortgageBalance] = useState("200000");
  const [downPayment, setDownPayment] = useState("20");
  const [loanAmount, setLoanAmount] = useState("300000");
  const [creditScore, setCreditScore] = useState("760");
  const [propertyType, setPropertyType] = useState("single_family");
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });

  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearch();
    }
  };

  const formatCurrency = (value: string) => {
    const num = parseInt(value.replace(/\D/g, "")) || 0;
    return num.toLocaleString();
  };

  const parseCurrency = (value: string) => {
    return value.replace(/\D/g, "");
  };

  return (
    <div className="bg-gradient-to-b from-primary/5 to-background pb-8">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8">
          <h1 
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4"
            data-testid="rate-page-title"
          >
            {title || loanTypeLabels[loanType]}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {description || loanTypeDescriptions[loanType]}
            {zipcode ? ` in ${zipcode}` : ""}. 
            Take the next step by getting a personalized quote in as quick as 3 minutes with no impact to your credit score.
          </p>
        </div>

        <Card className="max-w-3xl mx-auto">
          <CardContent className="p-6">
            <div className="grid w-full grid-cols-2 gap-1 mb-6 bg-muted p-1 rounded-lg">
              <Link
                href="/rates/purchase"
                className={cn(
                  "flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  loanTypeToTab[loanType] === "mortgage" 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid="tab-mortgage"
              >
                Mortgage
              </Link>
              <Link
                href="/rates/heloc"
                className={cn(
                  "flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  loanTypeToTab[loanType] === "home-equity" 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid="tab-home-equity"
              >
                Home equity
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="zipcode" className="text-sm font-medium text-muted-foreground">
                  Zip code
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="zipcode"
                    type="text"
                    placeholder="Enter ZIP code"
                    value={zipcode}
                    onChange={(e) => onZipcodeChange(e.target.value.replace(/\D/g, "").slice(0, 5))}
                    onKeyPress={handleKeyPress}
                    className="pl-10 h-12"
                    maxLength={5}
                    data-testid="input-zipcode"
                  />
                </div>
              </div>

              {showCashOutAmount && (
                <div className="space-y-2">
                  <Label htmlFor="cashout" className="text-sm font-medium text-muted-foreground">
                    Cash-out amount
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="cashout"
                      type="text"
                      value={`$${formatCurrency(cashOutAmount)}`}
                      onChange={(e) => setCashOutAmount(parseCurrency(e.target.value))}
                      className="pl-10 h-12"
                      data-testid="input-cashout-amount"
                    />
                  </div>
                </div>
              )}

              {showPropertyValue && (
                <div className="space-y-2">
                  <Label htmlFor="property-value" className="text-sm font-medium text-muted-foreground">
                    Property Value
                  </Label>
                  <div className="relative">
                    <Home className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="property-value"
                      type="text"
                      value={`$${formatCurrency(propertyValue)}`}
                      onChange={(e) => setPropertyValue(parseCurrency(e.target.value))}
                      className="pl-10 h-12"
                      data-testid="input-property-value"
                    />
                  </div>
                </div>
              )}

              {showMortgageBalance && (
                <div className="space-y-2">
                  <Label htmlFor="mortgage-balance" className="text-sm font-medium text-muted-foreground">
                    Current Mortgage balance
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="mortgage-balance"
                      type="text"
                      value={`$${formatCurrency(mortgageBalance)}`}
                      onChange={(e) => setMortgageBalance(parseCurrency(e.target.value))}
                      className="pl-10 h-12"
                      data-testid="input-mortgage-balance"
                    />
                  </div>
                </div>
              )}

              {showDownPayment && (
                <div className="space-y-2">
                  <Label htmlFor="down-payment" className="text-sm font-medium text-muted-foreground">
                    Down Payment (%)
                  </Label>
                  <Input
                    id="down-payment"
                    type="text"
                    value={`${downPayment}%`}
                    onChange={(e) => setDownPayment(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    className="h-12"
                    data-testid="input-down-payment"
                  />
                </div>
              )}

              {showLoanAmount && (
                <div className="space-y-2">
                  <Label htmlFor="loan-amount" className="text-sm font-medium text-muted-foreground">
                    Loan Amount
                  </Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="loan-amount"
                      type="text"
                      value={`$${formatCurrency(loanAmount)}`}
                      onChange={(e) => setLoanAmount(parseCurrency(e.target.value))}
                      className="pl-10 h-12"
                      data-testid="input-loan-amount"
                    />
                  </div>
                </div>
              )}
            </div>

            {showAdvancedInputs && (
              <Collapsible 
                open={isAdvancedOpen} 
                onOpenChange={setIsAdvancedOpen}
                className="mt-4"
              >
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between text-muted-foreground hover:text-foreground"
                    data-testid="button-advanced-inputs"
                  >
                    Advanced inputs
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isAdvancedOpen ? "rotate-180" : ""}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {showCreditScore && (
                      <div className="space-y-2">
                        <Label htmlFor="credit-score" className="text-sm font-medium text-muted-foreground">
                          Credit Score
                        </Label>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="credit-score"
                            type="text"
                            value={creditScore}
                            onChange={(e) => setCreditScore(e.target.value.replace(/\D/g, "").slice(0, 3))}
                            className="pl-10 h-12"
                            data-testid="input-credit-score"
                          />
                        </div>
                      </div>
                    )}

                    {showPropertyType && (
                      <div className="space-y-2">
                        <Label htmlFor="property-type" className="text-sm font-medium text-muted-foreground">
                          Property Type
                        </Label>
                        <Select value={propertyType} onValueChange={setPropertyType}>
                          <SelectTrigger className="h-12" data-testid="select-property-type">
                            <SelectValue placeholder="Select property type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single_family">Single Family Home</SelectItem>
                            <SelectItem value="condo">Condo</SelectItem>
                            <SelectItem value="townhouse">Townhouse</SelectItem>
                            <SelectItem value="multi_family">Multi-Family (2-4 units)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={onSearch} 
                size="lg" 
                className="flex-1"
                disabled={zipcode.length !== 5}
                data-testid="button-search-rates"
              >
                Get Rates
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-6">
          <Clock className="h-4 w-4" />
          <span>Rates updated at {currentTime} on {currentDate}</span>
        </div>
      </div>
    </div>
  );
}
