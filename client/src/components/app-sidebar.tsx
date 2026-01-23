import { type ComponentType } from "react";
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
import { isStaffRole } from "@shared/schema";
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
  Percent,
  PenSquare,
  Star,
  Calculator,
} from "lucide-react";

// Client navigation - for Aspiring Owners and Active Buyers
const aspiringOwnerNavigation = [
  {
    section: "Explore Homeownership",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, testId: "link-borrower-dashboard" },
      { title: "Gap to Homeownership", href: "/gap-calculator", icon: Calculator, testId: "link-gap-calculator" },
      { title: "Browse Properties", href: "/properties", icon: Home, testId: "link-properties" },
    ],
  },
  {
    section: "Get Ready",
    items: [
      { title: "Pre-Approval", href: "/pre-approval", icon: Star, testId: "link-pre-approval" },
      { title: "Resources", href: "/resources", icon: BookOpen, testId: "link-resources" },
    ],
  },
];

const activeBuyerNavigation = [
  {
    section: "My Mortgage",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, testId: "link-borrower-dashboard" },
      { title: "My Application", href: "/application-summary", icon: FileText, testId: "link-application-summary" },
      { title: "My Tasks", href: "/tasks", icon: CheckSquare, testId: "link-tasks" },
      { title: "Verification", href: "/verification", icon: Shield, testId: "link-verification" },
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
      { title: "Broker Dashboard", href: "/broker-dashboard", icon: DollarSign, testId: "link-broker-dashboard" },
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
      { title: "Admin Dashboard", href: "/admin", icon: LayoutDashboard, testId: "link-admin" },
      { title: "Manage Users", href: "/admin/users", icon: Users, testId: "link-admin-users" },
      { title: "Manage Rates", href: "/admin/rates", icon: Percent, testId: "link-admin-rates" },
      { title: "Manage Content", href: "/admin/content", icon: PenSquare, testId: "link-admin-content" },
    ],
  },
];

// Navigation item type for proper typing
interface NavItem {
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  testId: string;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const isActive = (href: string) => location === href;
  
  // Use the isStaffRole helper from schema
  const userRole = user?.role || "";
  const isStaff = isStaffRole(userRole);
  const isAdmin = userRole === "admin";
  const isAspiringOwner = userRole === "aspiring_owner";

  // Select appropriate navigation based on role
  let navigation: NavSection[];
  if (isStaff) {
    navigation = staffNavigation;
  } else if (isAspiringOwner) {
    navigation = aspiringOwnerNavigation;
  } else {
    navigation = activeBuyerNavigation;
  }
  
  // Get role display name for portal label
  const portalLabel = isStaff 
    ? "Staff Portal" 
    : isAspiringOwner 
      ? "Aspiring Owner" 
      : "Active Buyer";

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-4">
          <p className="text-sm font-semibold">MortgageAI</p>
          <p className="text-xs text-muted-foreground">
            {portalLabel}
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
