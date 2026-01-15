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
import PurchaseRates from "@/pages/rates/PurchaseRates";
import RefinanceRates from "@/pages/rates/RefinanceRates";
import CashOutRates from "@/pages/rates/CashOutRates";
import HelocRates from "@/pages/rates/HelocRates";
import VaRates from "@/pages/rates/VaRates";
import BrokerDashboard from "@/pages/BrokerDashboard";

function PublicPage({ children }: { children: React.ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}

function BorrowerPage({ children }: { children: React.ReactNode }) {
  return <PrivateLayout>{children}</PrivateLayout>;
}

function StaffPage({ children }: { children: React.ReactNode }) {
  return <PrivateLayout requiredRoles={["broker", "lender", "admin"]}>{children}</PrivateLayout>;
}

function AdminPage({ children }: { children: React.ReactNode }) {
  return <PrivateLayout requiredRoles={["admin"]}>{children}</PrivateLayout>;
}

function Router() {
  return (
    <Switch>
      {/* Public Pages - Anyone can access */}
      <Route path="/" component={Landing} />
      <Route path="/apply" component={PreApproval} />
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

      {/* Private Pages - Borrower (logged-in clients working on their application) */}
      <Route path="/dashboard">
        <BorrowerPage><Dashboard /></BorrowerPage>
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
      <Route path="/credit-consent/:id">
        {(params) => <BorrowerPage><CreditConsent /></BorrowerPage>}
      </Route>
      <Route path="/urla-form">
        <BorrowerPage><URLAForm /></BorrowerPage>
      </Route>
      <Route path="/documents">
        <BorrowerPage><Documents /></BorrowerPage>
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

      {/* Private Pages - Admin only (manage content, rates, users) */}
      <Route path="/admin">
        <AdminPage><AdminDashboard /></AdminPage>
      </Route>
      <Route path="/admin/rates">
        <AdminPage><AdminRates /></AdminPage>
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
