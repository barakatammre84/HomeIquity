import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, User, Building2, Shield, ArrowRight, Home } from "lucide-react";

interface ReferrerInfo {
  valid: boolean;
  loName: string;
  nmlsId?: string;
  companyName?: string;
}

export default function ReferralLanding() {
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [applied, setApplied] = useState(false);

  const { data: referrer, isLoading, error } = useQuery<ReferrerInfo>({
    queryKey: ["/api/referral", code],
    enabled: !!code,
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/apply-referral", { referralCode: code });
      return res.json();
    },
    onSuccess: (data: any) => {
      setApplied(true);
      toast({
        title: "Connected",
        description: data.message || "You've been connected with your loan officer!",
      });
      localStorage.removeItem("pendingReferralCode");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply referral code",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (code) {
      localStorage.setItem("pendingReferralCode", code);
    }
  }, [code]);

  useEffect(() => {
    if (user && !applied && referrer?.valid && !applyMutation.isPending) {
      applyMutation.mutate();
    }
  }, [user, applied, referrer]);

  const handleGetStarted = () => {
    if (user) {
      setLocation("/dashboard");
    } else {
      setLocation("/auth");
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-10" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !referrer?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-destructive" data-testid="text-invalid-code">
              Invalid Referral Link
            </CardTitle>
            <CardDescription>
              This referral link is not valid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")} className="w-full" data-testid="button-go-home">
              <Home className="h-4 w-4 mr-2" />
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <User className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-welcome">
            {applied ? "You're Connected!" : `Welcome from ${referrer.loName}`}
          </CardTitle>
          <CardDescription>
            {applied 
              ? `You've been connected with ${referrer.loName}`
              : "Your personal loan officer is ready to help you get pre-approved"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium" data-testid="text-lo-name">{referrer.loName}</div>
                <div className="text-sm text-muted-foreground">Your Loan Officer</div>
              </div>
            </div>
            {referrer.nmlsId && (
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium">NMLS# {referrer.nmlsId}</div>
                  <div className="text-sm text-muted-foreground">Licensed Mortgage Professional</div>
                </div>
              </div>
            )}
            {referrer.companyName && (
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="font-medium" data-testid="text-company">{referrer.companyName}</div>
                  <div className="text-sm text-muted-foreground">Company</div>
                </div>
              </div>
            )}
          </div>

          {applied ? (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span>Successfully connected</span>
              </div>
              <Button onClick={handleGetStarted} className="w-full" data-testid="button-go-dashboard">
                Go to Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-center gap-2">
                <Badge variant="secondary">3-Minute Pre-Approval</Badge>
                <Badge variant="secondary">No Credit Impact</Badge>
                <Badge variant="secondary">Free Service</Badge>
              </div>
              <Button 
                onClick={handleGetStarted} 
                className="w-full" 
                size="lg"
                disabled={applyMutation.isPending}
                data-testid="button-get-started"
              >
                {user ? "Go to Dashboard" : "Get Started"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                By continuing, you'll be connected with {referrer.loName} as your loan officer.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
