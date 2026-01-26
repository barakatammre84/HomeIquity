import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import type { Document } from "@shared/schema";
import {
  FileText,
  Download,
  Upload,
  CheckCircle2,
  Circle,
  AlertCircle,
  User,
  DollarSign,
  Building2,
  CreditCard,
  Home,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Clock,
  Shield,
} from "lucide-react";

interface DashboardData {
  documents: Document[];
}

// Document categories with their required document types
const DOCUMENT_CATEGORIES = [
  {
    id: "identity",
    name: "Identity & Compliance",
    description: "Government-issued ID and identity verification",
    icon: User,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    documents: [
      { type: "drivers_license", name: "Driver's License", required: true, description: "Valid state-issued driver's license" },
      { type: "passport", name: "Passport", required: false, description: "Valid passport (alternative to driver's license)" },
      { type: "ssn_card", name: "Social Security Card", required: false, description: "Social Security card if available" },
    ]
  },
  {
    id: "income",
    name: "Income Verification",
    description: "Pay stubs, tax returns, and employment documents",
    icon: DollarSign,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    documents: [
      { type: "paystub", name: "Recent Pay Stubs", required: true, description: "Last 30 days of pay stubs" },
      { type: "w2", name: "W-2 Forms", required: true, description: "W-2s from the last 2 years" },
      { type: "tax_return_1040", name: "Tax Returns (1040)", required: true, description: "Personal tax returns from last 2 years" },
      { type: "1099_misc", name: "1099 Forms", required: false, description: "1099 forms if you have additional income" },
      { type: "profit_loss_statement", name: "Profit & Loss Statement", required: false, description: "For self-employed borrowers" },
      { type: "social_security_award_letter", name: "Social Security Award Letter", required: false, description: "If receiving Social Security income" },
    ]
  },
  {
    id: "assets",
    name: "Assets & Savings",
    description: "Bank statements, retirement accounts, and investments",
    icon: Building2,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    documents: [
      { type: "bank_statement_checking", name: "Checking Account Statements", required: true, description: "Last 2 months of statements" },
      { type: "bank_statement_savings", name: "Savings Account Statements", required: true, description: "Last 2 months of statements" },
      { type: "retirement_statement_401k", name: "401(k) Statement", required: false, description: "Most recent quarterly statement" },
      { type: "retirement_statement_ira", name: "IRA Statement", required: false, description: "Most recent quarterly statement" },
      { type: "brokerage_statement", name: "Brokerage Statement", required: false, description: "Investment account statements" },
      { type: "gift_letter", name: "Gift Letter", required: false, description: "If receiving gift funds for down payment" },
    ]
  },
  {
    id: "liabilities",
    name: "Current Debts",
    description: "Existing mortgages, loans, and credit obligations",
    icon: CreditCard,
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    documents: [
      { type: "mortgage_statement", name: "Mortgage Statement", required: false, description: "Current mortgage payment info (if applicable)" },
      { type: "auto_loan_statement", name: "Auto Loan Statement", required: false, description: "Current auto loan info (if applicable)" },
      { type: "student_loan_statement", name: "Student Loan Statement", required: false, description: "Student loan payment info (if applicable)" },
      { type: "credit_card_statement", name: "Credit Card Statements", required: false, description: "Most recent statements" },
    ]
  },
  {
    id: "property",
    name: "Property & Transaction",
    description: "Purchase contract, insurance, and property documents",
    icon: Home,
    color: "text-rose-600",
    bgColor: "bg-rose-50 dark:bg-rose-900/20",
    documents: [
      { type: "purchase_contract", name: "Purchase Contract", required: true, description: "Signed purchase agreement" },
      { type: "earnest_money_receipt", name: "Earnest Money Receipt", required: true, description: "Proof of earnest money deposit" },
      { type: "homeowners_insurance_binder", name: "Homeowners Insurance Binder", required: true, description: "Proof of insurance coverage" },
      { type: "appraisal_report", name: "Appraisal Report", required: false, description: "Provided by lender" },
      { type: "title_commitment", name: "Title Commitment", required: false, description: "Provided by title company" },
    ]
  },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "verified":
      return <Badge className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">Verified</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    case "pending_review":
      return <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Under Review</Badge>;
    default:
      return <Badge variant="secondary">Uploaded</Badge>;
  }
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function Documents() {
  const { isLoading: authLoading } = useAuth();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["income", "assets"]);

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: !authLoading,
  });

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  if (authLoading || isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="mb-8 h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const documents = data?.documents || [];

  // Create a map of uploaded documents by type
  const documentsByType = documents.reduce((acc, doc) => {
    if (!acc[doc.documentType]) {
      acc[doc.documentType] = [];
    }
    acc[doc.documentType].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  // Calculate overall progress
  const allRequiredDocs = DOCUMENT_CATEGORIES.flatMap(cat =>
    cat.documents.filter(d => d.required)
  );
  const uploadedRequiredCount = allRequiredDocs.filter(d =>
    documentsByType[d.type]?.length > 0
  ).length;
  const overallProgress = allRequiredDocs.length > 0
    ? Math.round((uploadedRequiredCount / allRequiredDocs.length) * 100)
    : 0;

  return (
    <>
      {/* Premium Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

        <div className="relative px-6 py-8">
          <div className="flex items-center gap-2 text-primary-foreground/80 mb-2">
            <FileText className="h-4 w-4" />
            <span className="text-sm font-medium">Document Center</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Document Checklist
          </h1>
          <p className="mt-1 text-primary-foreground/80">
            Upload the required documents to complete your application
          </p>

          {/* Progress Summary */}
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3 bg-white/10 rounded-lg px-4 py-2">
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{overallProgress}%</div>
                <div className="text-xs text-primary-foreground/70">Complete</div>
              </div>
              <Progress value={overallProgress} className="w-24 h-2 bg-white/20" />
            </div>
            <div className="flex items-center gap-2 text-primary-foreground/80">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm">{uploadedRequiredCount} of {allRequiredDocs.length} required docs uploaded</span>
            </div>
          </div>
        </div>
      </div>

      {/* Document Categories */}
      <div className="p-4 sm:p-6 lg:p-8 -mt-6 space-y-4">
        {DOCUMENT_CATEGORIES.map((category) => {
          const CategoryIcon = category.icon;
          const isExpanded = expandedCategories.includes(category.id);

          // Calculate category progress
          const requiredInCategory = category.documents.filter(d => d.required);
          const uploadedInCategory = requiredInCategory.filter(d =>
            documentsByType[d.type]?.length > 0
          ).length;
          const categoryProgress = requiredInCategory.length > 0
            ? Math.round((uploadedInCategory / requiredInCategory.length) * 100)
            : 100;

          const allUploaded = categoryProgress === 100;
          const hasUploads = category.documents.some(d => documentsByType[d.type]?.length > 0);

          return (
            <Card key={category.id} className="shadow-lg border-0" data-testid={`card-category-${category.id}`}>
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${category.bgColor}`}>
                      <CategoryIcon className={`h-5 w-5 ${category.color}`} />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {category.name}
                        {allUploaded && requiredInCategory.length > 0 && (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        )}
                      </CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {requiredInCategory.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Progress value={categoryProgress} className="w-20 h-2" />
                        <span className="text-sm text-muted-foreground w-10">
                          {categoryProgress}%
                        </span>
                      </div>
                    )}
                    {hasUploads && !isExpanded && (
                      <Badge variant="secondary" className="text-xs">
                        {category.documents.filter(d => documentsByType[d.type]?.length > 0).length} uploaded
                      </Badge>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="border-t pt-4">
                    <div className="space-y-3">
                      {category.documents.map((docType) => {
                        const uploadedDocs = documentsByType[docType.type] || [];
                        const hasUpload = uploadedDocs.length > 0;
                        const latestDoc = uploadedDocs[uploadedDocs.length - 1];

                        return (
                          <div
                            key={docType.type}
                            className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                              hasUpload
                                ? "bg-emerald-50/50 dark:bg-emerald-900/10"
                                : docType.required
                                ? "bg-amber-50/50 dark:bg-amber-900/10"
                                : "bg-muted/30"
                            }`}
                            data-testid={`row-doctype-${docType.type}`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              {hasUpload ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                              ) : docType.required ? (
                                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{docType.name}</span>
                                  {docType.required && !hasUpload && (
                                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
                                      Required
                                    </Badge>
                                  )}
                                  {docType.required && hasUpload && (
                                    <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400">
                                      Complete
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {docType.description}
                                </p>
                                {hasUpload && latestDoc && (
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <FileCheck className="h-3 w-3" />
                                      {latestDoc.fileName}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatDate(latestDoc.createdAt)}
                                    </span>
                                    {latestDoc.status && (
                                      <span className="flex items-center gap-1">
                                        <Shield className="h-3 w-3" />
                                        {getStatusBadge(latestDoc.status)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              {hasUpload && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1.5"
                                  data-testid={`button-download-${docType.type}`}
                                >
                                  <Download className="h-4 w-4" />
                                  <span className="hidden sm:inline">View</span>
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant={hasUpload ? "outline" : "default"}
                                className="gap-1.5"
                                data-testid={`button-upload-${docType.type}`}
                              >
                                <Upload className="h-4 w-4" />
                                <span className="hidden sm:inline">
                                  {hasUpload ? "Replace" : "Upload"}
                                </span>
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {/* Uploaded Documents Summary */}
        {documents.length > 0 && (
          <Card className="shadow-lg border-0 mt-8" data-testid="card-all-documents">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                All Uploaded Documents
              </CardTitle>
              <CardDescription>
                {documents.length} document{documents.length !== 1 ? "s" : ""} in your file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        Document Type
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        File Name
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        Uploaded
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr
                        key={doc.id}
                        className="border-b transition-colors hover:bg-muted/50"
                        data-testid={`row-document-${doc.id}`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <FileCheck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium capitalize">
                              {doc.documentType.replace(/_/g, " ")}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm">{doc.fileName}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-muted-foreground">
                            {formatDate(doc.createdAt)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {getStatusBadge(doc.status || "uploaded")}
                        </td>
                        <td className="px-4 py-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2"
                            data-testid={`button-download-doc-${doc.id}`}
                          >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">Download</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
