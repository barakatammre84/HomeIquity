import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import type { LoanApplication } from "@shared/schema";
import { formatCurrency } from "@/lib/authUtils";
import {
  User,
  Briefcase,
  DollarSign,
  Home,
  FileText,
  Percent,
  ChevronRight,
  Save,
} from "lucide-react";

interface DashboardData {
  applications: LoanApplication[];
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

export default function URLAForm() {
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
            <Skeleton className="h-96" />
          </div>
        </div>
      </SidebarProvider>
    );
  }

  const applications = data?.applications || [];
  const activeApplication = applications.find(
    (app) => !["closed", "denied"].includes(app.status)
  );

  if (!activeApplication) {
    return (
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex-1 p-8">
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-lg font-medium">No active application</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="border-b p-4 sm:p-6 lg:p-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Uniform Residential Loan Application
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete URLA Form (Freddie Mac Form 65 / Fannie Mae Form 1003)
            </p>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            <Tabs defaultValue="borrower" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="borrower" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Borrower</span>
                </TabsTrigger>
                <TabsTrigger value="employment" className="gap-2">
                  <Briefcase className="h-4 w-4" />
                  <span className="hidden sm:inline">Employment</span>
                </TabsTrigger>
                <TabsTrigger value="assets" className="gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="hidden sm:inline">Assets</span>
                </TabsTrigger>
                <TabsTrigger value="liabilities" className="gap-2">
                  <Percent className="h-4 w-4" />
                  <span className="hidden sm:inline">Liabilities</span>
                </TabsTrigger>
                <TabsTrigger value="property" className="gap-2">
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Property</span>
                </TabsTrigger>
              </TabsList>

              {/* Section 1: Borrower Information */}
              <TabsContent value="borrower" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Borrower Information</CardTitle>
                    <CardDescription>Section 1a: Personal Information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="first-name">First Name</Label>
                        <Input id="first-name" placeholder="First name" data-testid="input-first-name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="middle-name">Middle Name</Label>
                        <Input id="middle-name" placeholder="Middle name" data-testid="input-middle-name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last-name">Last Name</Label>
                        <Input id="last-name" placeholder="Last name" data-testid="input-last-name" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="ssn">Social Security Number</Label>
                        <Input id="ssn" placeholder="XXX-XX-XXXX" data-testid="input-ssn" type="password" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dob">Date of Birth</Label>
                        <Input id="dob" type="date" data-testid="input-dob" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="citizenship">Citizenship</Label>
                        <Select>
                          <SelectTrigger id="citizenship">
                            <SelectValue placeholder="Select citizenship" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="us-citizen">U.S. Citizen</SelectItem>
                            <SelectItem value="permanent-resident">Permanent Resident Alien</SelectItem>
                            <SelectItem value="non-permanent">Non-Permanent Resident Alien</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="marital-status">Marital Status</Label>
                        <Select>
                          <SelectTrigger id="marital-status">
                            <SelectValue placeholder="Select marital status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="married">Married</SelectItem>
                            <SelectItem value="separated">Separated</SelectItem>
                            <SelectItem value="single">Single</SelectItem>
                            <SelectItem value="divorced">Divorced</SelectItem>
                            <SelectItem value="widowed">Widowed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dependents">Number of Dependents</Label>
                        <Input id="dependents" type="number" min="0" placeholder="0" data-testid="input-dependents" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dependent-ages">Dependent Ages</Label>
                        <Input id="dependent-ages" placeholder="Enter ages separated by commas" data-testid="input-dependent-ages" />
                      </div>
                    </div>

                    <hr />

                    <div className="space-y-4">
                      <h4 className="font-semibold">Contact Information</h4>
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="home-phone">Home Phone</Label>
                          <Input id="home-phone" type="tel" placeholder="(XXX) XXX-XXXX" data-testid="input-home-phone" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cell-phone">Cell Phone</Label>
                          <Input id="cell-phone" type="tel" placeholder="(XXX) XXX-XXXX" data-testid="input-cell-phone" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="work-phone">Work Phone</Label>
                          <Input id="work-phone" type="tel" placeholder="(XXX) XXX-XXXX" data-testid="input-work-phone" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input id="email" type="email" placeholder="email@example.com" data-testid="input-email" />
                        </div>
                      </div>
                    </div>

                    <hr />

                    <div className="space-y-4">
                      <h4 className="font-semibold">Current Address</h4>
                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="street">Street Address</Label>
                          <Input id="street" placeholder="Street address" data-testid="input-street" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="unit">Unit #</Label>
                          <Input id="unit" placeholder="Unit # (if applicable)" data-testid="input-unit" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="city">City</Label>
                          <Input id="city" placeholder="City" data-testid="input-city" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="state">State</Label>
                          <Select>
                            <SelectTrigger id="state">
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {US_STATES.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="zip">ZIP Code</Label>
                          <Input id="zip" placeholder="ZIP code" data-testid="input-zip" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="years-at-address">Years at Address</Label>
                          <div className="flex gap-2">
                            <Input type="number" placeholder="Years" min="0" max="80" className="flex-1" data-testid="input-years" />
                            <Input type="number" placeholder="Months" min="0" max="11" className="flex-1" data-testid="input-months" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <Label>Housing Expense</Label>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2">
                            <Checkbox id="own" data-testid="checkbox-own" />
                            <Label htmlFor="own" className="font-normal">Own</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox id="rent" data-testid="checkbox-rent" />
                            <Label htmlFor="rent" className="font-normal">Rent</Label>
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            <Label htmlFor="rent-amount" className="font-normal">Rent Amount:</Label>
                            <Input id="rent-amount" type="number" placeholder="$0" min="0" className="flex-1" data-testid="input-rent-amount" />
                            <span className="text-sm text-muted-foreground">/month</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 2: Employment/Self-Employment and Income */}
              <TabsContent value="employment" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Current Employment/Self-Employment</CardTitle>
                    <CardDescription>Section 1b: Income Information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="employer">Employer Name</Label>
                        <Input 
                          id="employer" 
                          placeholder="Employer name" 
                          defaultValue={activeApplication.employerName || ""}
                          data-testid="input-employer" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="employer-phone">Employer Phone</Label>
                        <Input id="employer-phone" type="tel" placeholder="(XXX) XXX-XXXX" data-testid="input-employer-phone" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="job-title">Position/Title</Label>
                        <Input id="job-title" placeholder="Job title" data-testid="input-job-title" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="employment-type">Employment Type</Label>
                        <Select defaultValue={activeApplication.employmentType || "employed"}>
                          <SelectTrigger id="employment-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employed">Employed</SelectItem>
                            <SelectItem value="self_employed">Self-Employed</SelectItem>
                            <SelectItem value="retired">Retired</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input id="start-date" type="date" data-testid="input-start-date" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="years-employed">Years in this line of work</Label>
                        <div className="flex gap-2">
                          <Input type="number" placeholder="Years" min="0" max="80" className="flex-1" data-testid="input-years-employed" />
                          <Input type="number" placeholder="Months" min="0" max="11" className="flex-1" data-testid="input-months-employed" />
                        </div>
                      </div>
                    </div>

                    <hr />

                    <div className="space-y-4">
                      <h4 className="font-semibold">Gross Monthly Income</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="base-income">Base</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                            <Input 
                              id="base-income" 
                              type="number" 
                              placeholder="0.00" 
                              min="0" 
                              step="0.01"
                              className="pl-6"
                              defaultValue={activeApplication.annualIncome ? String(parseFloat(activeApplication.annualIncome.toString()) / 12) : ""}
                              data-testid="input-base-income"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="overtime">Overtime</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                            <Input 
                              id="overtime" 
                              type="number" 
                              placeholder="0.00" 
                              min="0" 
                              step="0.01"
                              className="pl-6"
                              data-testid="input-overtime"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="bonus">Bonus</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                            <Input 
                              id="bonus" 
                              type="number" 
                              placeholder="0.00" 
                              min="0" 
                              step="0.01"
                              className="pl-6"
                              data-testid="input-bonus"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="commission">Commission</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                            <Input 
                              id="commission" 
                              type="number" 
                              placeholder="0.00" 
                              min="0" 
                              step="0.01"
                              className="pl-6"
                              data-testid="input-commission"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="military">Military Entitlements</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                            <Input 
                              id="military" 
                              type="number" 
                              placeholder="0.00" 
                              min="0" 
                              step="0.01"
                              className="pl-6"
                              data-testid="input-military"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="other-income">Other</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                            <Input 
                              id="other-income" 
                              type="number" 
                              placeholder="0.00" 
                              min="0" 
                              step="0.01"
                              className="pl-6"
                              data-testid="input-other-income"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 3: Assets */}
              <TabsContent value="assets" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Assets</CardTitle>
                    <CardDescription>Section 2a: Bank Accounts, Retirement, and Other Accounts</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="border rounded-lg p-4 space-y-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label htmlFor={`account-type-${i}`}>Account Type</Label>
                              <Select>
                                <SelectTrigger id={`account-type-${i}`}>
                                  <SelectValue placeholder="Select account type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="checking">Checking</SelectItem>
                                  <SelectItem value="savings">Savings</SelectItem>
                                  <SelectItem value="money-market">Money Market</SelectItem>
                                  <SelectItem value="cd">Certificate of Deposit</SelectItem>
                                  <SelectItem value="retirement">Retirement (401k, IRA)</SelectItem>
                                  <SelectItem value="stocks">Stocks</SelectItem>
                                  <SelectItem value="bonds">Bonds</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`institution-${i}`}>Financial Institution</Label>
                              <Input id={`institution-${i}`} placeholder="Bank name" data-testid={`input-institution-${i}`} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`account-number-${i}`}>Account Number</Label>
                              <Input id={`account-number-${i}`} placeholder="Account #" data-testid={`input-account-number-${i}`} />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`cash-value-${i}`}>Cash or Market Value</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                              <Input 
                                id={`cash-value-${i}`} 
                                type="number" 
                                placeholder="0.00" 
                                min="0" 
                                step="0.01"
                                className="pl-6"
                                data-testid={`input-cash-value-${i}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 4: Liabilities */}
              <TabsContent value="liabilities" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Liabilities</CardTitle>
                    <CardDescription>Section 2b: Debts and Monthly Obligations</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="border rounded-lg p-4 space-y-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor={`liability-type-${i}`}>Liability Type</Label>
                              <Select>
                                <SelectTrigger id={`liability-type-${i}`}>
                                  <SelectValue placeholder="Select liability type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="credit-card">Credit Card</SelectItem>
                                  <SelectItem value="auto-loan">Auto Loan</SelectItem>
                                  <SelectItem value="student-loan">Student Loan</SelectItem>
                                  <SelectItem value="personal-loan">Personal Loan</SelectItem>
                                  <SelectItem value="mortgage">Mortgage</SelectItem>
                                  <SelectItem value="rent">Rent</SelectItem>
                                  <SelectItem value="child-support">Child Support</SelectItem>
                                  <SelectItem value="alimony">Alimony</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`creditor-${i}`}>Creditor Name</Label>
                              <Input id={`creditor-${i}`} placeholder="Creditor name" data-testid={`input-creditor-${i}`} />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`balance-${i}`}>Balance</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                <Input 
                                  id={`balance-${i}`} 
                                  type="number" 
                                  placeholder="0.00" 
                                  min="0" 
                                  step="0.01"
                                  className="pl-6"
                                  data-testid={`input-balance-${i}`}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`monthly-payment-${i}`}>Monthly Payment</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                <Input 
                                  id={`monthly-payment-${i}`} 
                                  type="number" 
                                  placeholder="0.00" 
                                  min="0" 
                                  step="0.01"
                                  className="pl-6"
                                  defaultValue={i === 1 ? (activeApplication.monthlyDebts || "0") : ""}
                                  data-testid={`input-monthly-payment-${i}`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 5: Property Information */}
              <TabsContent value="property" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Property Information</CardTitle>
                    <CardDescription>Section 3: Details about the property being financed</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="property-street">Street Address</Label>
                        <Input 
                          id="property-street" 
                          placeholder="Property address"
                          defaultValue={activeApplication.propertyAddress || ""}
                          data-testid="input-property-street"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="property-unit">Unit #</Label>
                        <Input id="property-unit" placeholder="Unit # (if applicable)" data-testid="input-property-unit" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="property-city">City</Label>
                        <Input 
                          id="property-city" 
                          placeholder="City"
                          defaultValue={activeApplication.propertyCity || ""}
                          data-testid="input-property-city"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="property-state">State</Label>
                        <Select defaultValue={activeApplication.propertyState || ""}>
                          <SelectTrigger id="property-state">
                            <SelectValue placeholder="Select state" />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state} value={state}>
                                {state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="property-zip">ZIP Code</Label>
                        <Input 
                          id="property-zip" 
                          placeholder="ZIP code"
                          defaultValue={activeApplication.propertyZip || ""}
                          data-testid="input-property-zip"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="property-type">Property Type</Label>
                        <Select defaultValue={activeApplication.propertyType || "single_family"}>
                          <SelectTrigger id="property-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single_family">Single Family Home</SelectItem>
                            <SelectItem value="condo">Condo</SelectItem>
                            <SelectItem value="townhouse">Townhouse</SelectItem>
                            <SelectItem value="multi_family">Multi-Family</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <hr />

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="purchase-price">Purchase Price</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                          <Input 
                            id="purchase-price" 
                            type="number" 
                            placeholder="0.00" 
                            min="0" 
                            step="0.01"
                            className="pl-6"
                            defaultValue={activeApplication.purchasePrice || ""}
                            data-testid="input-purchase-price"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="down-payment">Down Payment</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                          <Input 
                            id="down-payment" 
                            type="number" 
                            placeholder="0.00" 
                            min="0" 
                            step="0.01"
                            className="pl-6"
                            defaultValue={activeApplication.downPayment || ""}
                            data-testid="input-down-payment"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="loan-purpose">Loan Purpose</Label>
                        <Select defaultValue={activeApplication.loanPurpose || "purchase"}>
                          <SelectTrigger id="loan-purpose">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="purchase">Purchase</SelectItem>
                            <SelectItem value="refinance">Refinance</SelectItem>
                            <SelectItem value="cash_out">Cash Out Refinance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="loan-type">Loan Type</Label>
                        <Select defaultValue={activeApplication.preferredLoanType || "conventional"}>
                          <SelectTrigger id="loan-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conventional">Conventional</SelectItem>
                            <SelectItem value="fha">FHA</SelectItem>
                            <SelectItem value="va">VA</SelectItem>
                            <SelectItem value="usda">USDA</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <hr />

                    <div className="space-y-4">
                      <h4 className="font-semibold">Special Circumstances</h4>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <Checkbox id="veteran" defaultChecked={!!activeApplication.isVeteran} data-testid="checkbox-veteran" />
                          <Label htmlFor="veteran" className="font-normal">I am a U.S. Veteran</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox id="first-time-buyer" defaultChecked={!!activeApplication.isFirstTimeBuyer} data-testid="checkbox-first-time-buyer" />
                          <Label htmlFor="first-time-buyer" className="font-normal">This is my first time buying a home</Label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="mt-8 flex justify-between gap-4">
              <Button variant="outline" data-testid="button-cancel">
                Cancel
              </Button>
              <Button className="gap-2" data-testid="button-save-urla">
                <Save className="h-4 w-4" />
                Save URLA Form
              </Button>
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
