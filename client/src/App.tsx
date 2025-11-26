import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import PreApproval from "@/pages/PreApproval";
import LoanOptions from "@/pages/LoanOptions";
import Dashboard from "@/pages/Dashboard";
import Properties from "@/pages/Properties";
import Documents from "@/pages/Documents";
import Resources from "@/pages/Resources";
import Staff from "@/pages/Staff";
import AdminDashboard from "@/pages/AdminDashboard";
import ApplicationSummary from "@/pages/ApplicationSummary";
import Tasks from "@/pages/Tasks";
import StaffDashboard from "@/pages/StaffDashboard";
import TaskDetail from "@/pages/TaskDetail";
import URLAForm from "@/pages/URLAForm";
import AgentProfile from "@/pages/AgentProfile";
import AgentDashboard from "@/pages/AgentDashboard";
import AgentEdit from "@/pages/AgentEdit";
import PropertyForm from "@/pages/PropertyForm";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/apply" component={PreApproval} />
      <Route path="/properties" component={Properties} />
      <Route path="/agent/dashboard" component={AgentDashboard} />
      <Route path="/agent/edit" component={AgentEdit} />
      <Route path="/agent/:agentId" component={AgentProfile} />
      <Route path="/property/new" component={PropertyForm} />
      <Route path="/property/:propertyId/edit" component={PropertyForm} />
      <Route path="/loan-options/:id" component={LoanOptions} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/application-summary" component={ApplicationSummary} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/task/:id" component={TaskDetail} />
      <Route path="/staff-dashboard" component={StaffDashboard} />
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
