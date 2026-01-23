import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Building2, Shield, Briefcase, Users, Home } from "lucide-react";

const testAccounts = [
  { email: "admin@test.com", password: "admin123", role: "Admin", icon: Shield, description: "Full system access" },
  { email: "broker@test.com", password: "broker123", role: "Broker", icon: Briefcase, description: "Manage referrals & commissions" },
  { email: "lender@test.com", password: "lender123", role: "Lender", icon: Building2, description: "Process loan applications" },
  { email: "borrower@test.com", password: "borrower123", role: "Borrower", icon: Home, description: "Apply for mortgages" },
];

export default function TestLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (loginEmail: string, loginPassword: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/test-login", {
        email: loginEmail,
        password: loginPassword,
      });
      
      const data = await response.json();
      
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      toast({
        title: "Logged in successfully",
        description: `Welcome, ${data.user.firstName}! Role: ${data.user.role}`,
      });

      if (data.user.role === "admin") {
        setLocation("/admin");
      } else if (data.user.role === "broker" || data.user.role === "lender") {
        setLocation("/broker-dashboard");
      } else {
        setLocation("/dashboard");
      }
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Test Login</h1>
          <p className="text-muted-foreground mt-2">Select a test account or enter credentials manually</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {testAccounts.map((account) => (
            <Card
              key={account.email}
              className="cursor-pointer hover-elevate"
              onClick={() => handleLogin(account.email, account.password)}
              data-testid={`card-login-${account.role.toLowerCase()}`}
            >
              <CardHeader className="pb-2">
                <account.icon className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">{account.role}</CardTitle>
                <CardDescription>{account.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {account.email}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Manual Login</CardTitle>
            <CardDescription>Enter test credentials manually</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@test.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="input-password"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          <p>Test Credentials:</p>
          <ul className="mt-2 space-y-1">
            {testAccounts.map((account) => (
              <li key={account.email}>
                <strong>{account.role}:</strong> {account.email} / {account.password}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
