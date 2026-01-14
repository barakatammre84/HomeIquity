import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  BookOpen,
  Upload,
  Users,
  LogOut,
  Clipboard,
  GitBranch,
  Shield,
  FolderOpen,
  Home,
  DollarSign,
  Building,
} from "lucide-react";

const borrowerNavigation = [
  {
    section: "My Mortgage",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, testId: "link-borrower-dashboard" },
      { title: "My Application", href: "/application-summary", icon: FileText, testId: "link-application-summary" },
      { title: "My Tasks", href: "/tasks", icon: CheckSquare, testId: "link-tasks" },
    ],
  },
  {
    section: "Documents",
    items: [
      { title: "URLA Form", href: "/urla-form", icon: Clipboard, testId: "link-urla-form" },
      { title: "Upload Documents", href: "/documents", icon: Upload, testId: "link-documents" },
    ],
  },
  {
    section: "Help",
    items: [
      { title: "Resources", href: "/resources", icon: BookOpen, testId: "link-resources" },
      { title: "Contact Staff", href: "/staff", icon: Users, testId: "link-staff" },
    ],
  },
];

const staffNavigation = [
  {
    section: "Staff Dashboard",
    items: [
      { title: "Overview", href: "/staff-dashboard", icon: LayoutDashboard, testId: "link-staff-overview" },
      { title: "Pipeline Queue", href: "/pipeline-queue", icon: GitBranch, testId: "link-pipeline-queue" },
    ],
  },
  {
    section: "Compliance",
    items: [
      { title: "TRID & MISMO", href: "/compliance", icon: Shield, testId: "link-compliance" },
    ],
  },
];

const adminNavigation = [
  {
    section: "Administration",
    items: [
      { title: "Admin Panel", href: "/admin", icon: Users, testId: "link-admin" },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const isActive = (href: string) => location === href;
  
  const isStaff = ["admin", "lender", "broker"].includes(user?.role || "");
  const isAdmin = user?.role === "admin";

  const navigation = isStaff ? staffNavigation : borrowerNavigation;

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-4">
          <p className="text-sm font-semibold">MortgageAI</p>
          <p className="text-xs text-muted-foreground">
            {isStaff ? "Staff Portal" : "Borrower Portal"}
          </p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navigation.map((section) => (
          <SidebarGroup key={section.section}>
            <SidebarGroupLabel>{section.section}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={`${section.section}-${item.title}`}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)}>
                      <Link href={item.href} className="cursor-pointer" data-testid={item.testId}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {isAdmin && adminNavigation.map((section) => (
          <SidebarGroup key={section.section}>
            <SidebarGroupLabel>{section.section}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={`${section.section}-${item.title}`}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)}>
                      <Link href={item.href} className="cursor-pointer" data-testid={item.testId}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/api/logout" className="cursor-pointer" data-testid="link-logout">
                <LogOut className="h-4 w-4" />
                <span>Log Out</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
