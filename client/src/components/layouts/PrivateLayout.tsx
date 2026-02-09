import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface PrivateLayoutProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export function PrivateLayout({ children, requiredRoles }: PrivateLayoutProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/api/login";
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && requiredRoles && requiredRoles.length > 0) {
      const hasRequiredRole = requiredRoles.some(role => user?.role === role);
      if (!hasRequiredRole) {
        navigate("/dashboard");
      }
    }
  }, [isLoading, isAuthenticated, user, requiredRoles, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.some(role => user?.role === role);
    if (!hasRequiredRole) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Access denied. Redirecting...</p>
          </div>
        </div>
      );
    }
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-background shrink-0 md:px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="hidden md:flex" />
              <span className="text-sm font-semibold tracking-tight text-primary md:hidden" data-testid="text-mobile-brand">baranest</span>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <Avatar className="h-8 w-8 md:hidden">
                  <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                    {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-background pb-16 md:pb-0">
            {children}
          </main>
          <MobileBottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}
