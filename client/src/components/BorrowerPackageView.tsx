import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Users,
  ArrowRightLeft,
  Briefcase,
  PiggyBank,
  CreditCard,
  Home,
  FileText,
  Target,
  AlertTriangle,
  Shield,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  MinusCircle,
} from "lucide-react";

interface BorrowerPackageData {
  generatedDate?: string;
  borrowerOverview?: {
    borrowerNames?: string;
    householdComposition?: string;
    primaryResidenceState?: string;
    incomeProfileType?: string;
  };
  householdOverview?: {
    firstTimeBuyer?: string;
    veteranStatus?: string;
  };
  transactionIntent?: {
    transactionType?: string;
    propertyIntent?: string;
    targetTimeframe?: string;
  };
  incomeSources?: Array<{
    source?: string;
    type?: string;
    amount?: string;
    period?: string;
    verificationTier?: string;
    employerName?: string | null;
    yearsEmployed?: string;
    businessStructure?: string | null;
  }>;
  assetCategories?: Array<{
    category?: string;
    estimatedValue?: string;
    verificationTier?: string;
    source?: string | null;
    giftLetterStatus?: string | null;
  }>;
  creditAndDebt?: {
    creditScore?: string;
    creditScoreVerification?: string;
    monthlyDebts?: string;
    monthlyDebtsVerification?: string;
    dtiRatio?: string;
    dtiNote?: string;
  };
  propertyIntent?: {
    purchasePrice?: string;
    downPayment?: string;
    downPaymentPercent?: string;
    ltvRatio?: string;
    propertyType?: string;
    location?: string;
  };
  documentInventory?: Array<{
    docType?: string;
    label?: string;
    status?: string;
    flags?: string[];
  }>;
  readinessStatus?: {
    tier?: string;
    inputsPresent?: string;
    completedCategories?: string[];
    outstandingGaps?: string[];
    strengths?: string[];
  };
  validationNotes?: string[];
  complianceFooter?: string;
}

const COMPLIANCE_FOOTER = "This intake summary is prepared for informational purposes only. It does not constitute a lending decision, pre-approval, commitment to lend, or assessment of creditworthiness. All information is borrower-declared or document-extracted and has not been independently verified by a lender. Loan eligibility, terms, and approval are determined solely during formal underwriting review.";

function safe(val: string | null | undefined, fallback = "Not Provided"): string {
  if (!val || val.trim() === "") return fallback;
  return val;
}

function isNotProvided(val: string | null | undefined): boolean {
  if (!val) return true;
  const lower = val.toLowerCase().trim();
  return lower === "not provided" || lower === "pending" || lower === "n/a" || lower === "insufficient data" || lower === "";
}

function formatCurrency(val: string): string {
  const num = Number(val.replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return val;
  return `$${num.toLocaleString()}`;
}

function VerificationBadge({ tier }: { tier: string }) {
  const lower = (tier || "").toLowerCase();
  if (lower.includes("tier 1") || lower.includes("document verified")) {
    return (
      <Badge variant="secondary" className="text-xs gap-1" data-testid="badge-verification-tier1">
        <CheckCircle2 className="w-3 h-3" />
        Tier 1 — Verified
      </Badge>
    );
  }
  if (lower.includes("tier 2") || lower.includes("application declared") || lower.includes("declared")) {
    return (
      <Badge variant="outline" className="text-xs gap-1" data-testid="badge-verification-tier2">
        <Clock className="w-3 h-3" />
        Tier 2 — Declared
      </Badge>
    );
  }
  if (lower.includes("tier 3") || lower.includes("self-reported") || lower.includes("self reported")) {
    return (
      <Badge variant="outline" className="text-xs gap-1 opacity-70" data-testid="badge-verification-tier3">
        <MinusCircle className="w-3 h-3" />
        Tier 3 — Self-Reported
      </Badge>
    );
  }
  if (isNotProvided(tier)) {
    return (
      <Badge variant="outline" className="text-xs gap-1 opacity-50" data-testid="badge-verification-none">
        <XCircle className="w-3 h-3" />
        Not Provided
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-xs" data-testid="badge-verification-other">{tier}</Badge>;
}

function DocStatusBadge({ status }: { status: string }) {
  const lower = (status || "").toLowerCase();
  if (lower.includes("verified")) {
    return (
      <Badge variant="secondary" className="text-xs gap-1" data-testid="badge-doc-verified">
        <CheckCircle2 className="w-3 h-3" />
        Verified
      </Badge>
    );
  }
  if (lower.includes("pending")) {
    return (
      <Badge variant="outline" className="text-xs gap-1" data-testid="badge-doc-pending">
        <Clock className="w-3 h-3" />
        Pending Review
      </Badge>
    );
  }
  if (lower.includes("not yet") || lower.includes("not received")) {
    return (
      <Badge variant="outline" className="text-xs gap-1 opacity-60" data-testid="badge-doc-missing">
        <XCircle className="w-3 h-3" />
        Not Received
      </Badge>
    );
  }
  if (lower.includes("not required")) {
    return (
      <Badge variant="outline" className="text-xs opacity-50" data-testid="badge-doc-not-required">
        N/A
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-xs" data-testid="badge-doc-other">{status}</Badge>;
}

function TierBadge({ tier }: { tier: string }) {
  const config: Record<string, { label: string; className: string }> = {
    ready_now: { label: "Ready Now", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
    almost_ready: { label: "Almost Ready", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
    building: { label: "Building", className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
    exploring: { label: "Exploring", className: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200" },
  };
  const c = config[tier || "exploring"] || config.exploring;
  return (
    <Badge className={`text-xs no-default-hover-elevate no-default-active-elevate ${c.className}`} data-testid={`badge-readiness-${tier || "unknown"}`}>
      {c.label}
    </Badge>
  );
}

function SectionHeader({ icon: Icon, title, number }: { icon: typeof User; title: string; number: number }) {
  return (
    <div className="flex items-center gap-2 mb-3 pb-2 border-b" data-testid={`header-section-${number}`}>
      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-muted text-muted-foreground text-xs font-medium">
        {number}
      </div>
      <Icon className="w-4 h-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold tracking-wide uppercase text-foreground">{title}</h3>
    </div>
  );
}

function DataRow({ label, value, testId, children }: { label: string; value?: string; testId?: string; children?: React.ReactNode }) {
  const displayValue = safe(value);
  const dimmed = isNotProvided(value);
  return (
    <div className={`flex items-start justify-between gap-4 py-1.5 ${dimmed ? "opacity-60" : ""}`} data-testid={testId}>
      <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
      {children ? children : <span className="text-sm font-medium text-right">{displayValue}</span>}
    </div>
  );
}

export default function BorrowerPackageView({ data }: { data: BorrowerPackageData }) {
  if (!data) return null;

  const overview = data.borrowerOverview || {};
  const household = data.householdOverview || {};
  const transaction = data.transactionIntent || {};
  const incomeSources = data.incomeSources || [];
  const assetCategories = data.assetCategories || [];
  const credit = data.creditAndDebt || {};
  const property = data.propertyIntent || {};
  const documents = data.documentInventory || [];
  const readiness = data.readinessStatus || {};
  const validationNotes = data.validationNotes || [];
  const footer = data.complianceFooter || COMPLIANCE_FOOTER;

  return (
    <div className="space-y-4" data-testid="borrower-package">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-semibold text-foreground" data-testid="text-package-title">
          Borrower Intake Summary
        </h2>
        {data.generatedDate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span data-testid="text-generated-date">Generated {data.generatedDate}</span>
          </div>
        )}
      </div>

      <Card data-testid="section-borrower-overview">
        <CardContent className="pt-4 pb-3 px-4 space-y-0">
          <SectionHeader icon={User} title="Borrower Overview" number={1} />
          <div className="space-y-0.5">
            <DataRow label="Borrower Name(s)" value={overview.borrowerNames} testId="row-borrower-names" />
            <DataRow label="Household Composition" value={overview.householdComposition} testId="row-household-composition" />
            <DataRow label="Primary Residence State" value={overview.primaryResidenceState} testId="row-residence-state" />
            <DataRow label="Income Profile Type" value={overview.incomeProfileType} testId="row-income-profile-type" />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="section-household">
        <CardContent className="pt-4 pb-3 px-4 space-y-0">
          <SectionHeader icon={Users} title="Household Details" number={2} />
          <div className="space-y-0.5">
            <DataRow label="First-Time Buyer" value={household.firstTimeBuyer} testId="row-first-time-buyer" />
            <DataRow label="Veteran Status" value={household.veteranStatus} testId="row-veteran-status" />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="section-transaction-intent">
        <CardContent className="pt-4 pb-3 px-4 space-y-0">
          <SectionHeader icon={ArrowRightLeft} title="Transaction Intent" number={3} />
          <div className="space-y-0.5">
            <DataRow label="Transaction Type" value={transaction.transactionType} testId="row-transaction-type" />
            <DataRow label="Property Intent" value={transaction.propertyIntent} testId="row-property-intent" />
            <DataRow label="Target Timeframe" value={transaction.targetTimeframe} testId="row-target-timeframe" />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="section-income">
        <CardContent className="pt-4 pb-3 px-4">
          <SectionHeader icon={Briefcase} title="Declared Income Sources" number={4} />
          {incomeSources.length === 0 ? (
            <p className="text-sm text-muted-foreground opacity-60" data-testid="text-income-empty">Not Provided</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-income">
                <thead>
                  <tr className="border-b" data-testid="row-income-header">
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Source</th>
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Type</th>
                    <th className="text-right py-1.5 pr-3 text-muted-foreground font-medium text-xs">Amount</th>
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Period</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium text-xs">Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeSources.map((inc, i) => (
                    <tr key={i} className="border-b last:border-0" data-testid={`row-income-${i}`}>
                      <td className="py-1.5 pr-3">
                        <div data-testid={`text-income-source-${i}`}>{safe(inc.source)}</div>
                        {inc.employerName && <div className="text-xs text-muted-foreground">{inc.employerName}</div>}
                        {inc.yearsEmployed && !isNotProvided(inc.yearsEmployed) && (
                          <div className="text-xs text-muted-foreground">{inc.yearsEmployed} yrs</div>
                        )}
                        {inc.businessStructure && (
                          <div className="text-xs text-muted-foreground">{inc.businessStructure}</div>
                        )}
                      </td>
                      <td className="py-1.5 pr-3" data-testid={`text-income-type-${i}`}>{safe(inc.type)}</td>
                      <td className="py-1.5 pr-3 text-right font-medium" data-testid={`text-income-amount-${i}`}>
                        {isNotProvided(inc.amount) ? (
                          <span className="opacity-60">Not Provided</span>
                        ) : (
                          formatCurrency(inc.amount!)
                        )}
                      </td>
                      <td className="py-1.5 pr-3" data-testid={`text-income-period-${i}`}>{safe(inc.period)}</td>
                      <td className="py-1.5 text-right"><VerificationBadge tier={safe(inc.verificationTier)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="section-assets">
        <CardContent className="pt-4 pb-3 px-4">
          <SectionHeader icon={PiggyBank} title="Asset Categories" number={5} />
          {assetCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground opacity-60" data-testid="text-assets-empty">Not Provided</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-assets">
                <thead>
                  <tr className="border-b" data-testid="row-assets-header">
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Category</th>
                    <th className="text-right py-1.5 pr-3 text-muted-foreground font-medium text-xs">Est. Value</th>
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Source</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium text-xs">Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {assetCategories.map((asset, i) => (
                    <tr key={i} className="border-b last:border-0" data-testid={`row-asset-${i}`}>
                      <td className="py-1.5 pr-3" data-testid={`text-asset-category-${i}`}>
                        <div>{safe(asset.category)}</div>
                        {asset.giftLetterStatus && asset.giftLetterStatus !== "null" && !isNotProvided(asset.giftLetterStatus) && (
                          <div className="text-xs text-muted-foreground">Gift letter: {asset.giftLetterStatus}</div>
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-right font-medium" data-testid={`text-asset-value-${i}`}>
                        {isNotProvided(asset.estimatedValue) ? (
                          <span className="opacity-60">Not Provided</span>
                        ) : (
                          formatCurrency(asset.estimatedValue!)
                        )}
                      </td>
                      <td className="py-1.5 pr-3" data-testid={`text-asset-source-${i}`}>{asset.source || "—"}</td>
                      <td className="py-1.5 text-right"><VerificationBadge tier={safe(asset.verificationTier)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="section-credit">
        <CardContent className="pt-4 pb-3 px-4 space-y-0">
          <SectionHeader icon={CreditCard} title="Credit and Debt Signals" number={6} />
          <div className="space-y-0.5">
            <DataRow label="Credit Score" testId="row-credit-score">
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className={`text-sm font-medium ${isNotProvided(credit.creditScore) ? "opacity-60" : ""}`}>
                  {safe(credit.creditScore)}
                </span>
                <VerificationBadge tier={safe(credit.creditScoreVerification)} />
              </div>
            </DataRow>
            <DataRow label="Monthly Debts" testId="row-monthly-debts">
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <span className={`text-sm font-medium ${isNotProvided(credit.monthlyDebts) ? "opacity-60" : ""}`}>
                  {isNotProvided(credit.monthlyDebts) ? safe(credit.monthlyDebts) : formatCurrency(credit.monthlyDebts!)}
                </span>
                <VerificationBadge tier={safe(credit.monthlyDebtsVerification)} />
              </div>
            </DataRow>
            <DataRow label="DTI Ratio" value={safe(credit.dtiRatio, "Insufficient Data")} testId="row-dti-ratio" />
          </div>
          {credit.dtiNote && !isNotProvided(credit.dtiRatio) && (
            <p className="text-xs text-muted-foreground mt-2 pt-2 border-t italic" data-testid="text-dti-note">
              {credit.dtiNote}
            </p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="section-property">
        <CardContent className="pt-4 pb-3 px-4 space-y-0">
          <SectionHeader icon={Home} title="Property Details" number={7} />
          <div className="space-y-0.5">
            <DataRow label="Purchase Price" testId="row-purchase-price">
              <span className={`text-sm font-medium ${isNotProvided(property.purchasePrice) ? "opacity-60" : ""}`}>
                {isNotProvided(property.purchasePrice) ? safe(property.purchasePrice) : formatCurrency(property.purchasePrice!)}
              </span>
            </DataRow>
            <DataRow label="Down Payment" testId="row-down-payment">
              <span className={`text-sm font-medium ${isNotProvided(property.downPayment) ? "opacity-60" : ""}`}>
                {isNotProvided(property.downPayment)
                  ? safe(property.downPayment)
                  : `${formatCurrency(property.downPayment!)}${!isNotProvided(property.downPaymentPercent) ? ` (${property.downPaymentPercent})` : ""}`}
              </span>
            </DataRow>
            <DataRow label="LTV Ratio" value={safe(property.ltvRatio, "Insufficient Data")} testId="row-ltv-ratio" />
            <DataRow label="Property Type" value={property.propertyType} testId="row-property-type" />
            <DataRow label="Location" value={property.location} testId="row-location" />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="section-documents">
        <CardContent className="pt-4 pb-3 px-4">
          <SectionHeader icon={FileText} title="Document Inventory" number={8} />
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground opacity-60" data-testid="text-documents-empty">No documents tracked</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-documents">
                <thead>
                  <tr className="border-b" data-testid="row-documents-header">
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Document</th>
                    <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium text-xs">Status</th>
                    <th className="text-left py-1.5 text-muted-foreground font-medium text-xs">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc, i) => (
                    <tr key={i} className="border-b last:border-0" data-testid={`row-doc-${i}`}>
                      <td className="py-1.5 pr-3" data-testid={`text-doc-label-${i}`}>{safe(doc.label, safe(doc.docType))}</td>
                      <td className="py-1.5 pr-3"><DocStatusBadge status={safe(doc.status)} /></td>
                      <td className="py-1.5">
                        {(doc.flags || []).length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {(doc.flags || []).map((flag, fi) => (
                              <Badge key={fi} variant="outline" className="text-xs gap-0.5" data-testid={`badge-doc-flag-${i}-${fi}`}>
                                <AlertTriangle className="w-3 h-3" />
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground" data-testid={`text-doc-no-flags-${i}`}>None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="section-readiness">
        <CardContent className="pt-4 pb-3 px-4">
          <SectionHeader icon={Target} title="Readiness Status" number={9} />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap" data-testid="row-readiness-tier">
              <span className="text-sm text-muted-foreground">Readiness Tier</span>
              <TierBadge tier={readiness.tier || "exploring"} />
            </div>
            <DataRow label="Required Inputs Present" value={readiness.inputsPresent} testId="row-inputs-present" />

            {(readiness.completedCategories || []).length > 0 && (
              <div data-testid="list-completed-categories">
                <span className="text-xs text-muted-foreground">Completed Categories</span>
                <div className="flex gap-1 flex-wrap mt-1">
                  {(readiness.completedCategories || []).map((cat, i) => (
                    <Badge key={i} variant="secondary" className="text-xs gap-1" data-testid={`badge-completed-${i}`}>
                      <CheckCircle2 className="w-3 h-3" /> {cat}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {(readiness.outstandingGaps || []).length > 0 && (
              <div data-testid="list-outstanding-gaps">
                <span className="text-xs text-muted-foreground">Outstanding Gaps</span>
                <ul className="mt-1 space-y-0.5">
                  {(readiness.outstandingGaps || []).map((gap, i) => (
                    <li key={i} className="text-sm flex items-start gap-1.5" data-testid={`text-gap-${i}`}>
                      <XCircle className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(readiness.strengths || []).length > 0 && (
              <div data-testid="list-strengths">
                <span className="text-xs text-muted-foreground">Strengths</span>
                <ul className="mt-1 space-y-0.5">
                  {(readiness.strengths || []).map((s, i) => (
                    <li key={i} className="text-sm flex items-start gap-1.5" data-testid={`text-strength-${i}`}>
                      <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="section-validation">
        <CardContent className="pt-4 pb-3 px-4">
          <SectionHeader icon={Shield} title="Validation Notes" number={10} />
          {validationNotes.length > 0 ? (
            <ul className="space-y-1">
              {validationNotes.map((note, i) => (
                <li key={i} className="text-sm flex items-start gap-1.5" data-testid={`text-validation-${i}`}>
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                  {note}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="text-no-validation-issues">No validation concerns identified at this time.</p>
          )}
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground border-t pt-3 leading-relaxed" data-testid="text-compliance-footer">
        {footer}
      </div>
    </div>
  );
}
