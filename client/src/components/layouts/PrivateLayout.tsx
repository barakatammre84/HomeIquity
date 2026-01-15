import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

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

  return <>{children}</>;
}
