import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PublicLayout } from "@/components/layouts/PublicLayout";
import { PrivateLayout } from "@/components/layouts/PrivateLayout";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import PreApproval from "@/pages/PreApproval";
import LoanOptions from "@/pages/LoanOptions";
import Dashboard from "@/pages/Dashboard";
import Documents from "@/pages/Documents";
import Resources from "@/pages/Resources";
import Staff from "@/pages/Staff";
import AdminDashboard from "@/pages/AdminDashboard";
import ApplicationSummary from "@/pages/ApplicationSummary";
import Tasks from "@/pages/Tasks";
import StaffDashboard from "@/pages/StaffDashboard";
import TaskDetail from "@/pages/TaskDetail";
import URLAForm from "@/pages/URLAForm";
import LoanPipeline from "@/pages/LoanPipeline";
import PipelineQueue from "@/pages/PipelineQueue";
import BorrowerFile from "@/pages/BorrowerFile";
import ComplianceDashboard from "@/pages/ComplianceDashboard";
import LoanEstimate from "@/pages/LoanEstimate";
import Verification from "@/pages/Verification";
import CreditConsent from "@/pages/CreditConsent";
import LearningCenter from "@/pages/LearningCenter";
import FAQ from "@/pages/FAQ";
import ArticleDetail from "@/pages/ArticleDetail";
import MortgageRates from "@/pages/MortgageRates";
import AdminRates from "@/pages/AdminRates";
import AdminContent from "@/pages/AdminContent";
import AdminUsers from "@/pages/AdminUsers";
import PurchaseRates from "@/pages/rates/PurchaseRates";
import RefinanceRates from "@/pages/rates/RefinanceRates";
import CashOutRates from "@/pages/rates/CashOutRates";
import HelocRates from "@/pages/rates/HelocRates";
import VaRates from "@/pages/rates/VaRates";
import BrokerDashboard from "@/pages/BrokerDashboard";
import RentVsBuyCalculator from "@/pages/calculators/RentVsBuyCalculator";
import AffordabilityCalculator from "@/pages/calculators/AffordabilityCalculator";
import MortgageCalculator from "@/pages/calculators/MortgageCalculator";
import TestLogin from "@/pages/TestLogin";
import GapCalculator from "@/pages/GapCalculator";
import InviteGenerator from "@/pages/InviteGenerator";
import ApplyInvite from "@/pages/ApplyInvite";
import AnalyticsDashboard from "@/pages/AnalyticsDashboard";
import EConsent from "@/pages/EConsent";
import PartnerServices from "@/pages/PartnerServices";
import ReferralLanding from "@/pages/ReferralLanding";
import PolicyOps from "@/pages/PolicyOps";
import BorrowerDealComparison from "@/pages/BorrowerDealComparison";
import Messages from "@/pages/Messages";
import TaskOperations from "@/pages/TaskOperations";
import Properties from "@/pages/Properties";
import PropertyDetail from "@/pages/PropertyDetail";
import BuyerProperties from "@/pages/BuyerProperties";
import AgentDashboard from "@/pages/AgentDashboard";
import AgentEdit from "@/pages/AgentEdit";
import PropertyForm from "@/pages/PropertyForm";
import Privacy from "@/pages/Privacy";
import IdentityVerification from "@/pages/IdentityVerification";
import OnboardingJourney from "@/pages/OnboardingJourney";
import AgentCoBranding from "@/pages/AgentCoBranding";
import FirstTimeBuyerHub from "@/pages/FirstTimeBuyerHub";
import DownPaymentWizard from "@/pages/DownPaymentWizard";
import PartnerLanding from "@/pages/PartnerLanding";
import AgentPipeline from "@/pages/AgentPipeline";
import ScenarioDesk from "@/pages/ScenarioDesk";
import DealRescue from "@/pages/DealRescue";
import StrategySessions from "@/pages/StrategySessions";
import AcceleratorProgram from "@/pages/AcceleratorProgram";
import ClosingGuarantee from "@/pages/ClosingGuarantee";
import HomeownerDashboard from "@/pages/HomeownerDashboard";

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
