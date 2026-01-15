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
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Home, LayoutDashboard, Users, Menu, X, Phone, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const buyMenuItems = [
  { href: "/apply", label: "Apply Now" },
  { href: "/rates/purchase", label: "Purchase Rates" },
  { href: "/calculators/affordability", label: "Affordability Calculator" },
  { href: "/calculators/mortgage", label: "Mortgage Calculator" },
  { href: "/calculators/rent-vs-buy", label: "Rent vs Buy Calculator" },
  { href: "/agents", label: "Find an Agent" },
  { href: "/va-loans", label: "VA Loans" },
  { href: "/resources", label: "Learning Center" },
];

const refinanceMenuItems = [
  { href: "/apply?type=refinance", label: "Apply Now" },
  { href: "/rates/refinance", label: "Refinance Rates" },
  { href: "/calculators/cashout", label: "Cash-out Refinance Calculator" },
  { href: "/resources", label: "Learning Center" },
];

const helocMenuItems = [
  { href: "/apply?type=heloc", label: "Apply Now" },
  { href: "/calculators/heloc", label: "Calculate Your Cash" },
  { href: "/heloc-vs-cashout", label: "HELOC vs. Cash-out Refinance" },
  { href: "/resources", label: "Learning Center" },
];

const ratesMenuItems = [
  { href: "/rates/purchase", label: "Purchase Mortgage Rates" },
  { href: "/rates/refinance", label: "Refinance Rates" },
  { href: "/rates/cashout", label: "Refinance Cash-out Rates" },
  { href: "/rates/heloc", label: "HELOC Rates" },
  { href: "/rates/va", label: "Purchase VA Rates" },
];

interface NavDropdownProps {
  label: string;
  items: { href: string; label: string }[];
  testId: string;
}

function NavDropdownItem({ href, label, parentLabel }: { href: string; label: string; parentLabel: string }) {
  const [, navigate] = useLocation();
  
  return (
    <li>
      <NavigationMenuLink
        className={cn(
          "block select-none rounded-md p-3 leading-none no-underline outline-none transition-colors cursor-pointer",
          "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
        )}
        onClick={() => navigate(href)}
        data-testid={`nav-dropdown-${parentLabel.toLowerCase()}-${label.toLowerCase().replace(/\s+/g, '-')}`}
      >
        <span className="text-sm font-medium">{label}</span>
      </NavigationMenuLink>
    </li>
  );
}

function NavDropdown({ label, items, testId }: NavDropdownProps) {
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger 
        className="bg-transparent text-green-100 hover:text-white hover:bg-green-800 data-[state=open]:bg-green-800 data-[state=open]:text-white"
        data-testid={testId}
      >
        {label}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className="grid w-[220px] gap-1 p-2">
          {items.map((item) => (
            <NavDropdownItem 
              key={item.href + item.label} 
              href={item.href} 
              label={item.label} 
              parentLabel={label} 
            />
          ))}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

function MobileNavSection({ label, items, onItemClick }: { label: string; items: { href: string; label: string }[]; onItemClick: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-green-800 pb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-2 text-left text-green-100 hover:text-white"
        data-testid={`mobile-nav-${label.toLowerCase()}`}
      >
        <span className="font-medium">{label}</span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="ml-4 flex flex-col gap-1 pb-2">
          {items.map((item) => (
            <Link key={item.href + item.label} href={item.href}>
              <Button
                variant="ghost"
                className="w-full justify-start text-green-200 hover:text-white hover:bg-green-800"
                onClick={onItemClick}
              >
                {item.label}
              </Button>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Navigation() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full bg-green-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-6 w-6 text-white" />
              <span className="text-xl font-bold text-white">MortgageAI</span>
            </Link>

            <div className="hidden lg:block">
              <NavigationMenu>
                <NavigationMenuList className="gap-0">
                  <NavDropdown label="Buy" items={buyMenuItems} testId="nav-dropdown-buy" />
                  <NavDropdown label="Refinance" items={refinanceMenuItems} testId="nav-dropdown-refinance" />
                  <NavDropdown label="HELOC" items={helocMenuItems} testId="nav-dropdown-heloc" />
                  <NavDropdown label="Rates" items={ratesMenuItems} testId="nav-dropdown-rates" />
                  <NavigationMenuItem>
                    <NavigationMenuLink 
                      className="group inline-flex h-9 w-max items-center justify-center rounded-md bg-transparent px-4 py-2 text-sm font-medium text-green-100 transition-colors hover:bg-green-800 hover:text-white focus:bg-green-800 focus:text-white focus:outline-none cursor-pointer"
                      onClick={() => window.location.href = '/resources'}
                    >
                      Better+
                    </NavigationMenuLink>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="hidden text-green-100 hover:text-white hover:bg-green-800 sm:flex"
              data-testid="button-phone"
            >
              <Phone className="h-5 w-5" />
            </Button>

            {isLoading ? (
              <div className="h-9 w-24 animate-pulse rounded-md bg-green-800" />
            ) : isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full" data-testid="user-menu-button">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={user.profileImageUrl || undefined} alt={user.firstName || "User"} />
                      <AvatarFallback className="bg-green-700 text-white">
                        {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-0.5 leading-none">
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
                    <Link href="/dashboard" className="w-full cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="w-full cursor-pointer">
                        <Users className="mr-2 h-4 w-4" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href="/api/logout" className="w-full cursor-pointer text-destructive" data-testid="button-logout">
                      Log out
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
                    className="text-green-100 hover:text-white hover:bg-green-800"
                    data-testid="button-login"
                  >
                    Sign in
                  </Button>
                </a>
                <Link href="/apply">
                  <Button
                    size="sm"
                    className="bg-green-500 text-white hover:bg-green-600"
                    data-testid="button-get-started"
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              className="text-green-100 hover:text-white hover:bg-green-800 lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-green-800 py-4 lg:hidden">
            <div className="flex flex-col gap-2">
              <MobileNavSection label="Buy" items={buyMenuItems} onItemClick={() => setMobileMenuOpen(false)} />
              <MobileNavSection label="Refinance" items={refinanceMenuItems} onItemClick={() => setMobileMenuOpen(false)} />
              <MobileNavSection label="HELOC" items={helocMenuItems} onItemClick={() => setMobileMenuOpen(false)} />
              <MobileNavSection label="Rates" items={ratesMenuItems} onItemClick={() => setMobileMenuOpen(false)} />
              <Link href="/resources">
                <Button
                  variant="ghost"
                  className="w-full justify-start text-green-100 hover:text-white hover:bg-green-800"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Better+
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
