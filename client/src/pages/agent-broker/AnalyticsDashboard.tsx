import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  CheckCircle,
  Users,
  DollarSign,
  FileText,
  Activity,
  Target
} from "lucide-react";

interface PipelineMetrics {
  totalApplications: number;
  byStatus: { status: string; count: number }[];
  avgCycleTimeHours: number | null;
  slaComplianceRate: number | null;
  closedVolume: string;
  fundedVolume: string;
}

interface BottleneckAnalysis {
  stage: string;
  avgTimeHours: number;
  count: number;
  atRisk: number;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  submitted: "bg-blue-100 text-blue-800",
  analyzing: "bg-yellow-100 text-yellow-800",
  pre_approved: "bg-green-100 text-green-800",
  verified: "bg-emerald-100 text-emerald-800",
  underwriting: "bg-purple-100 text-purple-800",
  approved: "bg-green-100 text-green-800",
  denied: "bg-red-100 text-red-800",
  closed: "bg-indigo-100 text-indigo-800",
  funded: "bg-green-200 text-green-900",
};

const formatHours = (hours: number | null): string => {
  if (hours === null || hours === 0) return "N/A";
  if (hours < 24) return `${hours.toFixed(1)} hrs`;
  const days = hours / 24;
  return `${days.toFixed(1)} days`;
};

const formatCurrency = (value: string): string => {
  const num = parseFloat(value);
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
};

export default function AnalyticsDashboard() {
  const { data: pipelineMetrics, isLoading: pipelineLoading } = useQuery<PipelineMetrics>({
    queryKey: ["/api/analytics/pipeline"],
  });

  const { data: bottlenecks, isLoading: bottlenecksLoading } = useQuery<BottleneckAnalysis[]>({
    queryKey: ["/api/analytics/bottlenecks"],
  });

  const { data: expiringLocks } = useQuery<any[]>({
    queryKey: ["/api/rate-locks/expiring", { days: 7 }],
  });

  if (pipelineLoading || bottlenecksLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  const totalInPipeline = pipelineMetrics?.byStatus
    .filter(s => !["closed", "funded", "denied"].includes(s.status))
    .reduce((sum, s) => sum + s.count, 0) || 0;

  return (
    <div className="min-h-screen overflow-auto">
      {/* Premium Analytics Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        
        <div className="relative px-6 py-8">
          <div className="flex items-center gap-2 text-primary-foreground/80 mb-2">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">Performance Insights</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl" data-testid="text-analytics-title">
            Analytics Dashboard
          </h1>
          <p className="mt-1 text-primary-foreground/80">
            Monitor cycle times, bottlenecks, and SLA compliance
          </p>
        </div>
      </div>

      {/* Stats Cards with overlap effect */}
      <div className="px-6 -mt-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card data-testid="card-total-applications">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelineMetrics?.totalApplications || 0}</div>
            <p className="text-xs text-muted-foreground">{totalInPipeline} in active pipeline</p>
          </CardContent>
        </Card>

        <Card data-testid="card-cycle-time">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cycle Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(pipelineMetrics?.avgCycleTimeHours || null)}</div>
            <p className="text-xs text-muted-foreground">Application to close</p>
          </CardContent>
        </Card>

        <Card data-testid="card-sla-compliance">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pipelineMetrics?.slaComplianceRate !== null 
                ? `${pipelineMetrics?.slaComplianceRate.toFixed(0)}%` 
                : "N/A"}
            </div>
            <Progress 
              value={pipelineMetrics?.slaComplianceRate || 0} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card data-testid="card-funded-volume">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Funded Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pipelineMetrics?.fundedVolume || "0")}</div>
            <p className="text-xs text-muted-foreground">
              Closed: {formatCurrency(pipelineMetrics?.closedVolume || "0")}
            </p>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* Main content */}
      <div className="px-6 pb-6">
      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline" data-testid="tab-pipeline">Pipeline Status</TabsTrigger>
          <TabsTrigger value="bottlenecks" data-testid="tab-bottlenecks">Bottleneck Analysis</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts & Risks</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Pipeline Distribution
              </CardTitle>
              <CardDescription>Current applications by status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pipelineMetrics?.byStatus.map((item) => (
                  <div key={item.status} className="flex items-center gap-4">
                    <div className="w-32 capitalize">
                      {item.status.replace(/_/g, " ")}
                    </div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ 
                            width: `${(item.count / (pipelineMetrics?.totalApplications || 1)) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                    <Badge className={statusColors[item.status] || "bg-gray-100"}>
                      {item.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bottlenecks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Stage Performance
              </CardTitle>
              <CardDescription>Average time spent in each stage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {bottlenecks?.map((stage) => (
                  <div key={stage.stage} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{stage.stage}</div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {formatHours(stage.avgTimeHours)} avg
                        </span>
                        <Badge variant="outline">{stage.count} completed</Badge>
                        {stage.atRisk > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {stage.atRisk} in progress
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Progress 
                      value={Math.min((stage.avgTimeHours / 72) * 100, 100)} 
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Expiring Rate Locks
                </CardTitle>
                <CardDescription>Rate locks expiring within 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                {expiringLocks && expiringLocks.length > 0 ? (
                  <div className="space-y-3">
                    {expiringLocks.slice(0, 5).map((lock: any) => (
                      <div key={lock.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <div className="font-medium">{lock.interestRate}% Rate</div>
                          <div className="text-sm text-muted-foreground">
                            Expires: {new Date(lock.expiresAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant="outline">
                          {Math.ceil((new Date(lock.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    No rate locks expiring soon
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                  SLA At-Risk Applications
                </CardTitle>
                <CardDescription>Applications approaching SLA deadlines</CardDescription>
              </CardHeader>
              <CardContent>
                {bottlenecks?.some(b => b.atRisk > 0) ? (
                  <div className="space-y-3">
                    {bottlenecks
                      .filter(b => b.atRisk > 0)
                      .map((stage) => (
                        <div key={stage.stage} className="flex items-center justify-between p-2 border rounded">
                          <div className="font-medium">{stage.stage}</div>
                          <Badge variant="destructive">{stage.atRisk} at risk</Badge>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    All applications within SLA targets
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}