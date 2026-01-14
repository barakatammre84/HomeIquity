import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/apply" component={PreApproval} />
      <Route path="/loan-options/:id" component={LoanOptions} />
      <Route path="/pipeline/:id" component={LoanPipeline} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/application-summary" component={ApplicationSummary} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/task/:id" component={TaskDetail} />
      <Route path="/verification" component={Verification} />
      <Route path="/staff-dashboard" component={StaffDashboard} />
      <Route path="/pipeline-queue" component={PipelineQueue} />
      <Route path="/borrower-file/:id" component={BorrowerFile} />
      <Route path="/loan-estimate/:id" component={LoanEstimate} />
      <Route path="/compliance" component={ComplianceDashboard} />
      <Route path="/urla-form" component={URLAForm} />
      <Route path="/documents" component={Documents} />
      <Route path="/resources" component={Resources} />
      <Route path="/staff" component={Staff} />
      <Route path="/admin" component={AdminDashboard} />
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
