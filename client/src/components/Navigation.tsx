import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, Users, Menu, X, Phone, ChevronDown, Home, Calculator, FileText, HelpCircle, DollarSign, Percent, Bot, MessageCircle, FolderOpen, CheckSquare } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const buyMenuItems: NavItem[] = [
  { href: "/apply", label: "Get Pre-Approved", description: "Start your home buying journey", icon: FileText },
  { href: "/rates/purchase", label: "Today's Rates", description: "See current purchase rates", icon: Percent },
  { href: "/calculators/affordability", label: "Affordability Calculator", description: "What can you afford?", icon: Calculator },
  { href: "/properties", label: "Browse Homes", description: "Find your dream home", icon: Home },
];

const refinanceMenuItems: NavItem[] = [
  { href: "/apply?type=refinance", label: "Apply to Refinance", description: "Lower your monthly payment", icon: FileText },
  { href: "/rates/refinance", label: "Refinance Rates", description: "Compare today's rates", icon: Percent },
  { href: "/rates/cash-out", label: "Cash-Out Refinance", description: "Access your home equity", icon: DollarSign },
];

const helocMenuItems: NavItem[] = [
  { href: "/apply?type=heloc", label: "Apply for HELOC", description: "Flexible home equity line", icon: FileText },
  { href: "/rates/heloc", label: "HELOC Rates", description: "Current HELOC rates", icon: Percent },
  { href: "/calculators/mortgage", label: "Mortgage Calculator", description: "Estimate your payments", icon: Calculator },
];

interface NavDropdownProps {
  label: string;
  items: NavItem[];
  testId: string;
}

function NavDropdown({ label, items, testId }: NavDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();

  return (
    <div 
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors",
          "text-foreground/80 hover:text-foreground",
          isOpen && "text-foreground"
        )}
        data-testid={testId}
      >
        {label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>
      
      <div className={cn(
        "absolute left-0 top-full pt-2 transition-opacity duration-150",
        isOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
      )}>
        <div className="w-72 rounded-xl border bg-card p-2 shadow-xl">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href + item.label}
                onClick={() => {
                  navigate(item.href);
                  setIsOpen(false);
                }}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted"
                data-testid={`nav-dropdown-${label.toLowerCase()}-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {Icon && (
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MobileNavSection({ label, items, onItemClick }: { label: string; items: NavItem[]; onItemClick: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border py-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-2 text-left"
        data-testid={`mobile-nav-${label.toLowerCase()}`}
      >
        <span className="font-medium text-foreground">{label}</span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="flex flex-col gap-1 pb-2 pl-4">
          {items.map((item) => (
            <Link key={item.href + item.label} href={item.href}>
              <button
                className="w-full py-2 text-left text-sm text-muted-foreground hover:text-foreground"
                onClick={onItemClick}
              >
                {item.label}
              </button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Navigation() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-2xl font-bold tracking-tight text-primary">baranest</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-1 lg:flex">
            <NavDropdown label="Buy" items={buyMenuItems} testId="nav-dropdown-buy" />
            <NavDropdown label="Refinance" items={refinanceMenuItems} testId="nav-dropdown-refinance" />
            <NavDropdown label="HELOC" items={helocMenuItems} testId="nav-dropdown-heloc" />
            <Link href="/rates">
              <button className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground">
                Rates
              </button>
            </Link>
            <Link href="/resources">
              <button className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground">
                Resources
              </button>
            </Link>
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2">
            {/* Phone - hidden on mobile */}
            <a href="tel:1-800-BARANEST" className="hidden sm:block">
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground"
                data-testid="button-phone"
              >
                <Phone className="h-4 w-4" />
                <span className="hidden md:inline">1-800-BARANEST</span>
              </Button>
            </a>

            {isLoading ? (
              <div className="h-9 w-20 animate-pulse rounded-lg bg-muted" />
            ) : isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2" data-testid="user-menu-button">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
                      <AvatarFallback className="bg-primary text-xs text-primary-foreground">
                        {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium md:inline">
                      {user.firstName || "Account"}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center gap-3 p-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      {user.firstName && (
                        <p className="text-sm font-medium" data-testid="text-user-name">
                          {user.firstName} {user.lastName}
                        </p>
                      )}
                      {user.email && (
                        <p className="text-xs text-muted-foreground" data-testid="text-user-email">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="w-full cursor-pointer" data-testid="menu-dashboard">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/ai-coach" className="w-full cursor-pointer" data-testid="menu-ai-coach">
                      <Bot className="mr-2 h-4 w-4" />
                      AI Coach
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/messages" className="w-full cursor-pointer" data-testid="menu-messages">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Messages
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/documents" className="w-full cursor-pointer" data-testid="menu-documents">
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Documents
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/tasks" className="w-full cursor-pointer" data-testid="menu-tasks">
                      <CheckSquare className="mr-2 h-4 w-4" />
                      Tasks
                    </Link>
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="w-full cursor-pointer" data-testid="menu-admin">
                          <Users className="mr-2 h-4 w-4" />
                          Admin Panel
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/api/logout" className="w-full cursor-pointer text-destructive" data-testid="button-logout">
                      Sign out
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <a href="/api/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden text-foreground/80 hover:text-foreground sm:inline-flex"
                    data-testid="button-login"
                  >
                    Sign in
                  </Button>
                </a>
                <Link href="/apply">
                  <Button
                    size="sm"
                    className="bg-emerald-500 font-semibold text-white shadow-md shadow-emerald-500/20"
                    data-testid="button-get-started"
                  >
                    Get Pre-Approved
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t py-4 lg:hidden">
            <div className="flex flex-col">
              <MobileNavSection label="Buy" items={buyMenuItems} onItemClick={() => setMobileMenuOpen(false)} />
              <MobileNavSection label="Refinance" items={refinanceMenuItems} onItemClick={() => setMobileMenuOpen(false)} />
              <MobileNavSection label="HELOC" items={helocMenuItems} onItemClick={() => setMobileMenuOpen(false)} />
              <Link href="/rates">
                <button
                  className="w-full border-b border-border py-4 text-left font-medium text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Rates
                </button>
              </Link>
              <Link href="/resources">
                <button
                  className="w-full py-4 text-left font-medium text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Resources
                </button>
              </Link>
              
              {isAuthenticated ? (
                <div className="mt-4 flex flex-col gap-1">
                  <Link href="/dashboard">
                    <button className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left text-sm font-medium text-foreground hover-elevate" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-link-dashboard">
                      <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                      Dashboard
                    </button>
                  </Link>
                  <Link href="/ai-coach">
                    <button className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left text-sm font-medium text-foreground hover-elevate" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-link-ai-coach">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                      AI Coach
                    </button>
                  </Link>
                  <Link href="/messages">
                    <button className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left text-sm font-medium text-foreground hover-elevate" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-link-messages">
                      <MessageCircle className="h-4 w-4 text-muted-foreground" />
                      Messages
                    </button>
                  </Link>
                  <Link href="/documents">
                    <button className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left text-sm font-medium text-foreground hover-elevate" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-link-documents">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      Documents
                    </button>
                  </Link>
                  <Link href="/tasks">
                    <button className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left text-sm font-medium text-foreground hover-elevate" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-link-tasks">
                      <CheckSquare className="h-4 w-4 text-muted-foreground" />
                      Tasks
                    </button>
                  </Link>
                  <div className="mt-2 border-t pt-3">
                    <a href="/api/logout">
                      <Button variant="outline" size="lg" className="w-full text-destructive" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-button-logout">
                        Sign out
                      </Button>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-3">
                  <a href="/api/login">
                    <Button variant="outline" size="lg" className="w-full" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-button-login">
                      Sign in
                    </Button>
                  </a>
                  <Link href="/apply">
                    <Button size="lg" className="w-full bg-emerald-500 font-semibold" onClick={() => setMobileMenuOpen(false)} data-testid="mobile-button-apply">
                      Get Pre-Approved
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
