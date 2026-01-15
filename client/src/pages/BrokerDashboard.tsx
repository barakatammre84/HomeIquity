import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, getStatusLabel, getStatusColor } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { LoanApplication, BrokerCommission, User } from "@shared/schema";
import {
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Wallet,
  FileText,
  BarChart3,
  ArrowUpRight,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";

interface BrokerStats {
  totalReferrals: number;
  activeReferrals: number;
  closedLoans: number;
  totalLoanVolume: string;
  totalCommissionsEarned: string;
  pendingCommissions: string;
}

interface ReferralWithBorrower extends LoanApplication {
  borrower: User;
}

interface CommissionWithApplication extends BrokerCommission {
  application: LoanApplication;
}

export default function BrokerDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery<BrokerStats>({
    queryKey: ["/api/broker/stats"],
    enabled: !!user,
  });

  const { data: referrals, isLoading: referralsLoading } = useQuery<ReferralWithBorrower[]>({
    queryKey: ["/api/broker/referrals"],
    enabled: !!user,
  });

  const { data: commissions, isLoading: commissionsLoading } = useQuery<CommissionWithApplication[]>({
    queryKey: ["/api/broker/commissions"],
    enabled: !!user,
  });

  const isLoading = authLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="mb-8 h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="mt-8 h-64" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Referrals",
      value: stats?.totalReferrals || 0,
      icon: Users,
      description: "All-time referrals",
    },
    {
      title: "Active Loans",
      value: stats?.activeReferrals || 0,
      icon: Clock,
      description: "In progress",
    },
    {
      title: "Closed Loans",
      value: stats?.closedLoans || 0,
      icon: CheckCircle2,
      description: "Successfully funded",
    },
    {
      title: "Loan Volume",
      value: formatCurrency(stats?.totalLoanVolume || "0"),
      icon: TrendingUp,
      description: "Closed volume",
    },
    {
      title: "Earned Commissions",
      value: formatCurrency(stats?.totalCommissionsEarned || "0"),
      icon: DollarSign,
      description: "Paid out",
    },
    {
      title: "Pending Commissions",
      value: formatCurrency(stats?.pendingCommissions || "0"),
      icon: Wallet,
      description: "Awaiting payment",
    },
  ];

  const getCommissionStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "approved":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">
            Broker Dashboard
          </h1>
          <p className="text-muted-foreground">
            Track your referrals, commissions, and performance
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`text-stat-${stat.title.toLowerCase().replace(/\s/g, "-")}`}>
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="referrals" className="space-y-4">
        <TabsList>
          <TabsTrigger value="referrals" data-testid="tab-referrals">
            <Users className="mr-2 h-4 w-4" />
            Referrals
          </TabsTrigger>
          <TabsTrigger value="commissions" data-testid="tab-commissions">
            <DollarSign className="mr-2 h-4 w-4" />
            Commissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="referrals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Referrals</CardTitle>
              <CardDescription>
                Track the status of all borrowers you've referred
              </CardDescription>
            </CardHeader>
            <CardContent>
              {referralsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : referrals && referrals.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Loan Purpose</TableHead>
                      <TableHead>Purchase Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((referral) => (
                      <TableRow key={referral.id} data-testid={`row-referral-${referral.id}`}>
                        <TableCell className="font-medium">
                          {referral.borrower?.firstName} {referral.borrower?.lastName}
                        </TableCell>
                        <TableCell className="capitalize">
                          {referral.loanPurpose?.replace("_", " ") || "Purchase"}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(referral.purchasePrice || "0")}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(referral.status)}>
                            {getStatusLabel(referral.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {referral.createdAt && format(new Date(referral.createdAt), "MMM d, yyyy")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">No referrals yet</h3>
                  <p className="text-muted-foreground">
                    Start referring borrowers to build your pipeline
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Commission History</CardTitle>
              <CardDescription>
                Track your commission payments and pending earnings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {commissionsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : commissions && commissions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan Amount</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((commission) => (
                      <TableRow key={commission.id} data-testid={`row-commission-${commission.id}`}>
                        <TableCell className="font-medium">
                          {formatCurrency(commission.loanAmount)}
                        </TableCell>
                        <TableCell>
                          {(Number(commission.commissionRate) * 100).toFixed(2)}%
                        </TableCell>
                        <TableCell className="font-semibold text-green-600 dark:text-green-400">
                          {formatCurrency(commission.commissionAmount)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getCommissionStatusColor(commission.status)}>
                            {commission.status.charAt(0).toUpperCase() + commission.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {commission.paidAt
                            ? format(new Date(commission.paidAt), "MMM d, yyyy")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <DollarSign className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="text-lg font-semibold">No commissions yet</h3>
                  <p className="text-muted-foreground">
                    Commissions will appear here when your referrals close
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
