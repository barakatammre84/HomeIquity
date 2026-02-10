import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Home, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  User,
  ArrowRight,
  Shield,
  FileText,
  Sparkles,
} from "lucide-react";

interface InviteValidation {
  valid: boolean;
  invite: {
    id: string;
    clientName: string | null;
    clientEmail: string | null;
    message: string | null;
    referrer: {
      firstName: string;
      lastName: string;
      role: string;
    } | null;
  };
}

export default function ApplyInvite() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const [inviteId, setInviteId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<InviteValidation>({
    queryKey: ["/api/application-invites/validate", token],
    queryFn: async () => {
      const response = await fetch(`/api/application-invites/validate/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Invalid invite link");
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (data?.invite?.id) {
      setInviteId(data.invite.id);
      sessionStorage.setItem("inviteId", data.invite.id);
      if (data.invite.clientEmail) {
        sessionStorage.setItem("prefillEmail", data.invite.clientEmail);
      }
      if (data.invite.clientName) {
        sessionStorage.setItem("prefillName", data.invite.clientName);
      }
    }
  }, [data]);

  const startApplication = () => {
    setLocation("/apply");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-8 w-64 mx-auto mb-2" />
            <Skeleton className="h-4 w-48 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-12" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl" data-testid="text-error-title">Invalid Link</CardTitle>
            <CardDescription data-testid="text-error-description">
              {(error as Error).message || "This invite link is invalid or has expired."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertTitle>What happened?</AlertTitle>
              <AlertDescription>
                Invite links expire after a set period for security. Please contact your loan officer 
                to request a new invite link.
              </AlertDescription>
            </Alert>
            <Button 
              className="w-full" 
              variant="outline" 
              onClick={() => setLocation("/")}
              data-testid="button-go-home"
            >
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const referrer = data?.invite?.referrer;
  const referrerName = referrer 
    ? `${referrer.firstName} ${referrer.lastName}`.trim() || "Your Loan Officer"
    : "Your Loan Officer";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Home className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4" data-testid="text-welcome-title">
            {data?.invite?.clientName 
              ? `Welcome, ${data.invite.clientName}!`
              : "Welcome!"}
          </h1>
          <p className="text-xl text-muted-foreground" data-testid="text-welcome-subtitle">
            You've been invited to start your mortgage application
          </p>
        </div>

        {referrer && (
          <Card className="mb-8">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium" data-testid="text-referrer-name">{referrerName}</p>
                <p className="text-sm text-muted-foreground">
                  {referrer.role === "lo" ? "Loan Officer" : 
                   referrer.role === "loa" ? "Loan Officer Assistant" : 
                   referrer.role === "admin" ? "Mortgage Specialist" : "Your Guide"}
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </CardContent>
            {data?.invite?.message && (
              <CardContent className="pt-0">
                <div className="bg-muted/50 rounded-lg p-4 italic text-muted-foreground" data-testid="text-personal-message">
                  "{data.invite.message}"
                </div>
              </CardContent>
            )}
          </Card>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Fast-Track Your Application
            </CardTitle>
            <CardDescription>
              Our streamlined process gets you pre-approved in as little as 3 minutes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Simple Questions</h3>
                  <p className="text-sm text-muted-foreground">
                    Answer a few basic questions about your finances
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Instant Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Get your pre-approval decision in minutes, not days
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium mb-1">Bank-Level Security</h3>
                  <p className="text-sm text-muted-foreground">
                    Your information is encrypted and protected
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button 
            size="lg" 
            className="text-lg px-8 py-6"
            onClick={startApplication}
            data-testid="button-start-application"
          >
            Start My Application
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            No credit check required for pre-approval
          </p>
        </div>
      </div>
    </div>
  );
}
