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

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/apply" component={PreApproval} />
      <Route path="/properties" component={Properties} />
      <Route path="/loan-options/:id" component={LoanOptions} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/documents" component={Documents} />
      <Route path="/resources" component={Resources} />
      <Route path="/staff" component={Staff} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/" component={Home} />
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
