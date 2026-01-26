import { type ComponentType, useState } from "react";
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
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Link2,
  BarChart3,
  Handshake,
  FileSignature,
  Scale,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Circle,
} from "lucide-react";

// Mock team members data - in a real app this would come from an API
const teamMembers = [
  { id: "lo-1", name: "Sarah Johnson", role: "Loan Officer", initials: "SJ", status: "online" },
  { id: "proc-1", name: "Mike Chen", role: "Processor", initials: "MC", status: "online" },
  { id: "uw-1", name: "Emily Davis", role: "Underwriter", initials: "ED", status: "away" },
  { id: "closer-1", name: "James Wilson", role: "Closer", initials: "JW", status: "offline" },
];

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
      { title: "Consents", href: "/e-consent", icon: FileSignature, testId: "link-econsent" },
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
      { title: "Analytics", href: "/analytics", icon: BarChart3, testId: "link-analytics" },
      { title: "Broker Dashboard", href: "/broker-dashboard", icon: DollarSign, testId: "link-broker-dashboard" },
      { title: "Invite Clients", href: "/invite-clients", icon: Link2, testId: "link-invite-clients" },
    ],
  },
  {
    section: "Partner Services",
    items: [
      { title: "Order Services", href: "/partner-services", icon: Handshake, testId: "link-partner-services" },
    ],
  },
  {
    section: "Compliance",
    items: [
      { title: "TRID & MISMO", href: "/compliance", icon: Shield, testId: "link-compliance" },
      { title: "Policy Operations", href: "/policy-ops", icon: Scale, testId: "link-policy-ops" },
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
      { title: "Policy Operations", href: "/admin/policy-ops", icon: Scale, testId: "link-admin-policy-ops" },
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
  const [isTeamExpanded, setIsTeamExpanded] = useState(true);

  const isActive = (href: string) => location === href;
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "text-emerald-500";
      case "away": return "text-amber-500";
      default: return "text-muted-foreground";
    }
  };
  
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
          <p className="text-sm font-semibold tracking-tight">baranest</p>
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

        {/* Your Team Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Your Team</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => setIsTeamExpanded(!isTeamExpanded)}
                  data-testid="button-team-toggle"
                >
                  <Users className="h-4 w-4" />
                  <span>Team Members</span>
                  {isTeamExpanded ? (
                    <ChevronDown className="ml-auto h-4 w-4" />
                  ) : (
                    <ChevronRight className="ml-auto h-4 w-4" />
                  )}
                </SidebarMenuButton>
                {isTeamExpanded && (
                  <SidebarMenuSub>
                    {teamMembers.map((member) => (
                      <SidebarMenuSubItem key={member.id}>
                        <SidebarMenuSubButton asChild>
                          <Link 
                            href={`/messages/${member.id}`} 
                            className="cursor-pointer flex items-center gap-2"
                            data-testid={`link-team-member-${member.id}`}
                          >
                            <div className="relative">
                              <Avatar className="h-6 w-6" data-testid={`avatar-team-${member.id}`}>
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                  {member.initials}
                                </AvatarFallback>
                              </Avatar>
                              <Circle 
                                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-current ${getStatusColor(member.status)}`}
                                data-testid={`status-team-${member.id}`}
                              />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm truncate" data-testid={`text-team-name-${member.id}`}>{member.name}</span>
                              <span className="text-xs text-muted-foreground truncate" data-testid={`text-team-role-${member.id}`}>{member.role}</span>
                            </div>
                            <MessageCircle className="ml-auto h-3.5 w-3.5 text-muted-foreground" data-testid={`icon-team-message-${member.id}`} />
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
