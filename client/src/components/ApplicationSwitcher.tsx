import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LoanApplication } from "@shared/schema";
import {
  ChevronDown,
  Home,
  RefreshCw,
  CreditCard,
  Plus,
  Check,
} from "lucide-react";

interface ApplicationSwitcherProps {
  applications: LoanApplication[];
  activeApplicationId?: string;
  onSelectApplication: (app: LoanApplication) => void;
}

function getLoanPurposeLabel(purpose: string | null | undefined): string {
  switch (purpose?.toLowerCase()) {
    case "purchase":
      return "Purchase";
    case "refinance":
      return "Refinance";
    case "cash_out":
      return "Cash-Out Refi";
    case "heloc":
      return "HELOC";
    default:
      return "Purchase";
  }
}

function getLoanPurposeIcon(purpose: string | null | undefined) {
  switch (purpose?.toLowerCase()) {
    case "refinance":
    case "cash_out":
      return RefreshCw;
    case "heloc":
      return CreditCard;
    default:
      return Home;
  }
}

function getOccupancyLabel(occupancy: string | null | undefined): string {
  switch (occupancy?.toLowerCase()) {
    case "primary_residence":
    case "primary":
      return "Primary";
    case "second_home":
    case "secondary":
      return "Secondary";
    case "investment":
      return "Investment";
    default:
      return "Primary";
  }
}

function getStatusBadge(status: string): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  switch (status) {
    case "pre_approved":
      return { label: "Pre-Approved", variant: "default" };
    case "conditionally_approved":
      return { label: "Conditional", variant: "secondary" };
    case "under_review":
      return { label: "In Review", variant: "secondary" };
    case "submitted":
      return { label: "Submitted", variant: "outline" };
    case "draft":
    case "incomplete":
      return { label: "Incomplete", variant: "outline" };
    case "denied":
      return { label: "Denied", variant: "destructive" };
    case "closed":
      return { label: "Closed", variant: "secondary" };
    default:
      return { label: "In Progress", variant: "outline" };
  }
}

function generateReferenceNumber(app: LoanApplication): string {
  const prefix = "BN";
  const idPart = app.id.slice(-6).toUpperCase();
  return `${prefix}-${idPart}`;
}

export function ApplicationSwitcher({ 
  applications, 
  activeApplicationId,
  onSelectApplication 
}: ApplicationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const activeApp = applications.find(app => app.id === activeApplicationId);
  const Icon = activeApp ? getLoanPurposeIcon(activeApp.loanPurpose) : Home;
  
  if (applications.length === 0) {
    return (
      <Link href="/pre-approval">
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-start-new-app">
          <Plus className="h-4 w-4" />
          Start Application
        </Button>
      </Link>
    );
  }

  const location = activeApp?.propertyCity && activeApp?.propertyState
    ? `${activeApp.propertyCity}, ${activeApp.propertyState}`
    : activeApp?.propertyState || "Location TBD";

  const loanType = activeApp ? getLoanPurposeLabel(activeApp.loanPurpose) : "";

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="gap-2 h-auto py-1 px-2 flex-wrap"
          data-testid="button-app-switcher"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className="h-4 w-4 shrink-0 text-primary" data-testid="icon-app-type" />
            <span className="text-sm font-medium" data-testid="text-location">{location}</span>
            <span className="text-sm text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground" data-testid="text-loan-type">{loanType}</span>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80" data-testid="dropdown-app-switcher">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Your Applications
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {applications.map((app) => {
          const appLocation = app.propertyCity && app.propertyState
            ? `${app.propertyCity}, ${app.propertyState}`
            : app.propertyState || "Location TBD";
          const AppIcon = getLoanPurposeIcon(app.loanPurpose);
          const status = getStatusBadge(app.status);
          const isActive = app.id === activeApplicationId;
          
          return (
            <DropdownMenuItem
              key={app.id}
              onClick={() => {
                onSelectApplication(app);
                setIsOpen(false);
              }}
              data-testid={`dropdown-item-app-${app.id}`}
            >
              <div className="flex items-start gap-3 w-full flex-wrap">
                <div className={`flex h-9 w-9 items-center justify-center rounded-md shrink-0 ${isActive ? 'bg-primary/20' : 'bg-muted'}`} data-testid={`icon-app-${app.id}`}>
                  <AppIcon className={`h-4 w-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground" data-testid={`text-app-ref-${app.id}`}>
                      {generateReferenceNumber(app)}
                    </span>
                    <Badge variant={status.variant} className="text-[10px]" data-testid={`badge-app-status-${app.id}`}>
                      {status.label}
                    </Badge>
                    {isActive && <Check className="h-3 w-3 text-primary ml-auto" data-testid={`icon-active-${app.id}`} />}
                  </div>
                  <p className="text-sm font-medium truncate" data-testid={`text-app-type-${app.id}`}>
                    {getLoanPurposeLabel(app.loanPurpose)}
                  </p>
                  <p className="text-xs text-muted-foreground truncate" data-testid={`text-app-location-${app.id}`}>
                    {appLocation} · {getOccupancyLabel((app as any).occupancyType)}
                  </p>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link 
            href="/pre-approval" 
            className="flex items-center gap-2 flex-wrap"
            data-testid="link-new-application"
          >
            <Plus className="h-4 w-4" />
            <span>Start New Application</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
