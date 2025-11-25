import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import type { Document } from "@shared/schema";
import {
  LayoutDashboard,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  Plus,
  Settings,
  BookOpen,
  CreditCard,
  Clock,
  FileCheck,
  ChevronRight,
} from "lucide-react";

const sidebarItems = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Application Summary",
    href: "/dashboard",
    icon: FileText,
  },
  {
    label: "Tasks",
    href: "/dashboard",
    icon: CheckCircle2,
  },
  {
    label: "My loans",
    href: "/dashboard",
    icon: CreditCard,
  },
  {
    label: "Resources",
    href: "/resources",
    icon: BookOpen,
  },
  {
    label: "Documents",
    href: "/documents",
    icon: FileCheck,
    active: true,
  },
  {
    label: "Staff",
    href: "/staff",
    icon: LayoutDashboard,
  },
];

interface DashboardData {
  documents: Document[];
}

function getStatusBadge(status: string) {
  switch (status) {
    case "verified":
      return <Badge className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">Verified</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="secondary">Uploaded</Badge>;
  }
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function Documents() {
  const { isLoading: authLoading } = useAuth();
  const [location] = useLocation();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: !authLoading,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <div className="w-60 border-r p-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="mb-3 h-4 w-32" />
            ))}
          </div>
          <div className="flex-1 p-8">
            <Skeleton className="mb-8 h-8 w-48" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  const documents = data?.documents || [];

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="w-full border-b bg-background p-4 sm:p-6 lg:w-60 lg:border-b-0 lg:border-r lg:p-6">
          <div className="mb-6 hidden lg:block">
            <h2 className="text-lg font-semibold">Menu</h2>
          </div>
          <nav className="space-y-1">
            {sidebarItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={item.active ? "default" : "ghost"}
                  className="w-full justify-start gap-3"
                  data-testid={`button-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1">
          <div className="border-b p-4 sm:p-6 lg:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Documents</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage your loan documents and upload required files
                </p>
              </div>
              <Button className="gap-2" data-testid="button-upload-document">
                <Plus className="h-4 w-4" />
                Upload Document
              </Button>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {documents.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-lg font-medium">No documents yet</p>
                  <p className="text-sm text-muted-foreground">
                    Upload your pay stubs, tax returns, and bank statements to support your application
                  </p>
                  <Button className="mt-6 gap-2" data-testid="button-upload-first">
                    <Plus className="h-4 w-4" />
                    Upload Your First Document
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Document List</CardTitle>
                  <CardDescription>
                    {documents.length} document{documents.length !== 1 ? "s" : ""} uploaded
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                            Document Type
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                            File Name
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                            Uploaded
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map((doc) => (
                          <tr
                            key={doc.id}
                            className="border-b transition-colors hover:bg-muted/50"
                            data-testid={`row-document-${doc.id}`}
                          >
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <FileCheck className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium capitalize">
                                  {doc.documentType.replace(/_/g, " ")}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-sm">{doc.fileName}</span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-sm text-muted-foreground">
                                {formatDate(doc.createdAt)}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              {getStatusBadge(doc.status || "uploaded")}
                            </td>
                            <td className="px-4 py-4">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="gap-2"
                                data-testid={`button-download-${doc.id}`}
                              >
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">Download</span>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
