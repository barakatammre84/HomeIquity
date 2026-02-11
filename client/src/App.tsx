import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { PrivateLayout } from "@/components/layouts/PrivateLayout";

import NotFound from "@/pages/not-found";
import { PreApproval, LoanOptions, LoanPipeline, LoanEstimate, ApplicationSummary, BorrowerDealComparison } from "@/pages/lending";
import { Dashboard, Documents, Tasks, TaskDetail, Messages, URLAForm, CreditConsent, Verification, IdentityVerification, OnboardingJourney, EConsent, GapCalculator, BuyerProperties } from "@/pages/borrower";
import { StaffDashboard, PipelineQueue, BorrowerFile, ComplianceDashboard, PolicyOps, TaskOperations, Staff } from "@/pages/staff";
import { AgentCoBranding, AgentDashboard, AgentEdit, AgentPipeline, BrokerDashboard, InviteGenerator, AnalyticsDashboard, PartnerServices, ReferralLanding, PartnerLanding, ApplyInvite } from "@/pages/agent-broker";
import { ScenarioDesk, DealRescue, StrategySessions, ClosingGuarantee } from "@/pages/realtor-engine";
import { Properties, PropertyDetail, LivePropertyDetail, PropertyForm } from "@/pages/property";
import { FirstTimeBuyerHub, DownPaymentWizard, LearningCenter, ArticleDetail, FAQ, Resources, AcceleratorProgram } from "@/pages/education";
import { HomeownerDashboard } from "@/pages/homeowner";
import { PurchaseRates, RefinanceRates, CashOutRates, HelocRates, VaRates, MortgageRates } from "@/pages/rates";
import { RentVsBuyCalculator, AffordabilityCalculator, MortgageCalculator } from "@/pages/calculators";
import { AdminDashboard, AdminRates, AdminContent, AdminUsers } from "@/pages/admin";
import { Landing, Privacy, Terms, Disclosures, TestLogin } from "@/pages/public";

function PublicPage({ children }: { children: React.ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}

function BorrowerPage({ children }: { children: React.ReactNode }) {
  return <PrivateLayout>{children}</PrivateLayout>;
}

function StaffPage({ children }: { children: React.ReactNode }) {
  return <PrivateLayout requiredRoles={["admin", "lo", "loa", "processor", "underwriter", "closer"]}>{children}</PrivateLayout>;
}

function AdminPage({ children }: { children: React.ReactNode }) {
  return <PrivateLayout requiredRoles={["admin"]}>{children}</PrivateLayout>;
}

function Router() {
  return (
    <Switch>
      {/* Public Pages - Anyone can access */}
      <Route path="/" component={Landing} />
      <Route path="/test-login" component={TestLogin} />
      <Route path="/apply" component={PreApproval} />
      <Route path="/apply/:token">
        {(params) => <ApplyInvite />}
      </Route>
      <Route path="/ref/:code">
        {(params) => <ReferralLanding />}
      </Route>
      <Route path="/partner/:profileId">
        {(params) => <PartnerLanding />}
      </Route>
      <Route path="/resources">
        <PublicPage><Resources /></PublicPage>
      </Route>
      <Route path="/learn">
        <PublicPage><LearningCenter /></PublicPage>
      </Route>
      <Route path="/learn/:slug">
        {(params) => <PublicPage><ArticleDetail /></PublicPage>}
      </Route>
      <Route path="/faq">
        <PublicPage><FAQ /></PublicPage>
      </Route>
      <Route path="/privacy">
        <Privacy />
      </Route>
      <Route path="/terms">
        <Terms />
      </Route>
      <Route path="/disclosures">
        <Disclosures />
      </Route>
      
      {/* Property Pages - Public */}
      <Route path="/first-time-buyer">
        <PublicPage><FirstTimeBuyerHub /></PublicPage>
      </Route>
      <Route path="/down-payment-wizard">
        <PublicPage><DownPaymentWizard /></PublicPage>
      </Route>
      <Route path="/properties">
        <PublicPage><Properties /></PublicPage>
      </Route>
      <Route path="/properties/live">
        <PublicPage><LivePropertyDetail /></PublicPage>
      </Route>
      <Route path="/properties/:id">
        {(params) => <PublicPage><PropertyDetail /></PublicPage>}
      </Route>

      {/* Rate Pages - Public with navigation header */}
      <Route path="/rates">
        <PublicPage><MortgageRates /></PublicPage>
      </Route>
      <Route path="/rates/purchase">
        <PublicPage><PurchaseRates /></PublicPage>
      </Route>
      <Route path="/rates/refinance">
        <PublicPage><RefinanceRates /></PublicPage>
      </Route>
      <Route path="/rates/cash-out">
        <PublicPage><CashOutRates /></PublicPage>
      </Route>
      <Route path="/rates/heloc">
        <PublicPage><HelocRates /></PublicPage>
      </Route>
      <Route path="/rates/va">
        <PublicPage><VaRates /></PublicPage>
      </Route>

      {/* Calculator Pages - Public with navigation header */}
      <Route path="/calculators/rent-vs-buy">
        <PublicPage><RentVsBuyCalculator /></PublicPage>
      </Route>
      <Route path="/calculators/affordability">
        <PublicPage><AffordabilityCalculator /></PublicPage>
      </Route>
      <Route path="/calculators/mortgage">
        <PublicPage><MortgageCalculator /></PublicPage>
      </Route>

      {/* Private Pages - Borrower (logged-in clients working on their application) */}
      <Route path="/dashboard">
        <BorrowerPage><Dashboard /></BorrowerPage>
      </Route>
      <Route path="/gap-calculator">
        <BorrowerPage><GapCalculator /></BorrowerPage>
      </Route>
      <Route path="/loan-options/:id">
        {(params) => <BorrowerPage><LoanOptions /></BorrowerPage>}
      </Route>
      <Route path="/pipeline/:id">
        {(params) => <BorrowerPage><LoanPipeline /></BorrowerPage>}
      </Route>
      <Route path="/application-summary">
        <BorrowerPage><ApplicationSummary /></BorrowerPage>
      </Route>
      <Route path="/tasks">
        <BorrowerPage><Tasks /></BorrowerPage>
      </Route>
      <Route path="/task/:id">
        {(params) => <BorrowerPage><TaskDetail /></BorrowerPage>}
      </Route>
      <Route path="/verification">
        <BorrowerPage><Verification /></BorrowerPage>
      </Route>
      <Route path="/identity-verification">
        <BorrowerPage><IdentityVerification /></BorrowerPage>
      </Route>
      <Route path="/onboarding">
        <BorrowerPage><OnboardingJourney /></BorrowerPage>
      </Route>
      <Route path="/credit-consent/:id">
        {(params) => <BorrowerPage><CreditConsent /></BorrowerPage>}
      </Route>
      <Route path="/urla-form">
        <BorrowerPage><URLAForm /></BorrowerPage>
      </Route>
      <Route path="/documents">
        <BorrowerPage><Documents /></BorrowerPage>
      </Route>
      <Route path="/compare-offers/:id">
        {(params) => <BorrowerPage><BorrowerDealComparison /></BorrowerPage>}
      </Route>
      <Route path="/messages">
        <BorrowerPage><Messages /></BorrowerPage>
      </Route>
      <Route path="/messages/:memberId">
        {(params) => <BorrowerPage><Messages /></BorrowerPage>}
      </Route>

      {/* Private Pages - Staff (brokers, lenders processing mortgage applications) */}
      <Route path="/staff-dashboard">
        <StaffPage><StaffDashboard /></StaffPage>
      </Route>
      <Route path="/pipeline-queue">
        <StaffPage><PipelineQueue /></StaffPage>
      </Route>
      <Route path="/borrower-file/:id">
        {(params) => <StaffPage><BorrowerFile /></StaffPage>}
      </Route>
      <Route path="/loan-estimate/:id">
        {(params) => <StaffPage><LoanEstimate /></StaffPage>}
      </Route>
      <Route path="/compliance">
        <StaffPage><ComplianceDashboard /></StaffPage>
      </Route>
      <Route path="/staff">
        <StaffPage><Staff /></StaffPage>
      </Route>
      <Route path="/broker-dashboard">
        <StaffPage><BrokerDashboard /></StaffPage>
      </Route>
      <Route path="/invite-clients">
        <StaffPage><InviteGenerator /></StaffPage>
      </Route>
      <Route path="/analytics">
        <StaffPage><AnalyticsDashboard /></StaffPage>
      </Route>
      <Route path="/partner-services">
        <StaffPage><PartnerServices /></StaffPage>
      </Route>
      <Route path="/co-branding">
        <StaffPage><AgentCoBranding /></StaffPage>
      </Route>
      <Route path="/agent-pipeline">
        <StaffPage><AgentPipeline /></StaffPage>
      </Route>
      <Route path="/scenario-desk">
        <StaffPage><ScenarioDesk /></StaffPage>
      </Route>
      <Route path="/deal-rescue">
        <StaffPage><DealRescue /></StaffPage>
      </Route>
      <Route path="/strategy-sessions">
        <StaffPage><StrategySessions /></StaffPage>
      </Route>
      <Route path="/closing-guarantee">
        <StaffPage><ClosingGuarantee /></StaffPage>
      </Route>
      <Route path="/policy-ops">
        <StaffPage><PolicyOps /></StaffPage>
      </Route>
      <Route path="/task-operations">
        <StaffPage><TaskOperations /></StaffPage>
      </Route>
      <Route path="/accelerator">
        <BorrowerPage><AcceleratorProgram /></BorrowerPage>
      </Route>
      <Route path="/homeowner-dashboard">
        <BorrowerPage><HomeownerDashboard /></BorrowerPage>
      </Route>
      <Route path="/e-consent">
        <BorrowerPage><EConsent /></BorrowerPage>
      </Route>
      <Route path="/buy">
        <BorrowerPage><BuyerProperties /></BorrowerPage>
      </Route>

      {/* Private Pages - Agent (real estate agents managing listings) */}
      <Route path="/agent/dashboard">
        <StaffPage><AgentDashboard /></StaffPage>
      </Route>
      <Route path="/agent/edit">
        <StaffPage><AgentEdit /></StaffPage>
      </Route>
      <Route path="/property/new">
        <StaffPage><PropertyForm /></StaffPage>
      </Route>
      <Route path="/property/:id/edit">
        {(params) => <StaffPage><PropertyForm /></StaffPage>}
      </Route>

      {/* Private Pages - Admin only (manage content, rates, users) */}
      <Route path="/admin">
        <AdminPage><AdminDashboard /></AdminPage>
      </Route>
      <Route path="/admin/rates">
        <AdminPage><AdminRates /></AdminPage>
      </Route>
      <Route path="/admin/content">
        <AdminPage><AdminContent /></AdminPage>
      </Route>
      <Route path="/admin/users">
        <AdminPage><AdminUsers /></AdminPage>
      </Route>
      <Route path="/admin/policy-ops">
        <AdminPage><PolicyOps /></AdminPage>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
