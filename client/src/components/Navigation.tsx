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
import { Home, LayoutDashboard, Users, Menu, X, Phone } from "lucide-react";
import { useState } from "react";

export function Navigation() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const publicLinks = [
    { href: "/buy", label: "Buy" },
    { href: "/apply", label: "Refinance" },
    { href: "/apply", label: "HELOC" },
    { href: "/apply", label: "Rates" },
    { href: "/resources", label: "Better+" },
  ];

  const authenticatedLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/buy", label: "Buy" },
    { href: "/apply", label: "Refinance" },
    { href: "/properties", label: "Properties" },
  ];

  const navLinks = isAuthenticated ? authenticatedLinks : publicLinks;

  const isActive = (path: string) => location === path;

  return (
    <nav className="sticky top-0 z-50 w-full bg-green-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-6 w-6 text-white" />
              <span className="text-xl font-bold text-white">MortgageAI</span>
            </Link>

            <div className="hidden lg:flex lg:items-center lg:gap-1">
              {navLinks.map((link, index) => (
                <Link key={`${link.href}-${index}`} href={link.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`text-green-100 hover:text-white hover:bg-green-800 ${
                      isActive(link.href) ? "bg-green-800 text-white" : ""
                    }`}
                    data-testid={`nav-link-${link.label.toLowerCase()}`}
                  >
                    {link.label}
                  </Button>
                </Link>
              ))}
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
                <Link href="/dashboard">
                  <Button
                    size="sm"
                    className="bg-green-500 text-white hover:bg-green-600"
                    data-testid="button-dashboard"
                  >
                    Dashboard
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
              {navLinks.map((link, index) => (
                <Link key={`${link.href}-${index}`} href={link.href}>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start text-green-100 hover:text-white hover:bg-green-800 ${
                      isActive(link.href) ? "bg-green-800 text-white" : ""
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
