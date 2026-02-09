import { type ComponentType, useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  Scale,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Circle,
  ListTodo,
  HelpCircle,
  GraduationCap,
  AlertCircle,
  Rocket,
  Fingerprint,
} from "lucide-react";

// Team member interface
interface TeamMember {
  id: string;
  name: string;
  role: string;
  initials: string;
  email: string | null;
  profileImageUrl: string | null;
  presenceStatus: 'online' | 'away' | 'offline';
}

// Get presence status color
function getStatusColor(status: string) {
  switch (status) {
    case "online": return "text-emerald-500";
    case "away": return "text-amber-500";
    default: return "text-muted-foreground";
  }
}

// Role display names for the sidebar
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin: "Tech/Ops Lead",
  lo: "Loan Officer",
  loa: "Loan Officer Assistant",
  processor: "Processor",
  underwriter: "Underwriter",
  closer: "Closer/Funder",
};

// Expected team roles for a complete loan team
const EXPECTED_TEAM_ROLES = ["lo", "processor", "underwriter", "closer"];

// Client navigation - for Aspiring Owners and Active Buyers
const aspiringOwnerNavigation = [
  {
    section: "Explore Homeownership",
    items: [
      { title: "Overview", href: "/dashboard", icon: LayoutDashboard, testId: "link-borrower-dashboard" },
      { title: "My Journey", href: "/onboarding", icon: Rocket, testId: "link-onboarding" },
      { title: "Gap to Homeownership", href: "/gap-calculator", icon: Calculator, testId: "link-gap-calculator" },
      { title: "Browse Properties", href: "/properties", icon: Home, testId: "link-properties" },
    ],
  },
  {
    section: "Get Ready",
    items: [
      { title: "Pre-Approval", href: "/apply", icon: Star, testId: "link-pre-approval" },
      { title: "Identity Verification", href: "/identity-verification", icon: Fingerprint, testId: "link-identity-verification" },
    ],
  },
];

const activeBuyerNavigation = [
  {
    section: "My Mortgage",
    items: [
      { title: "Overview", href: "/dashboard", icon: LayoutDashboard, testId: "link-borrower-dashboard" },
      { title: "My Journey", href: "/onboarding", icon: Rocket, testId: "link-onboarding" },
      { title: "Tasks", href: "/tasks", icon: CheckSquare, testId: "link-tasks", showBadge: true },
      { title: "Identity Verification", href: "/identity-verification", icon: Fingerprint, testId: "link-identity-verification" },
      { title: "Verification", href: "/verification", icon: Shield, testId: "link-verification" },
    ],
  },
  {
    section: "My Files",
    items: [
      { title: "My Application", href: "/application-summary", icon: FileText, testId: "link-application-summary" },
      { title: "Documents", href: "/documents", icon: Upload, testId: "link-documents" },
      { title: "URLA Form", href: "/urla-form", icon: Clipboard, testId: "link-urla-form" },
    ],
  },
];

const staffNavigation = [
  {
    section: "Staff Dashboard",
    items: [
      { title: "Overview", href: "/staff-dashboard", icon: LayoutDashboard, testId: "link-staff-overview" },
      { title: "Pipeline Queue", href: "/pipeline-queue", icon: GitBranch, testId: "link-pipeline-queue" },
      { title: "Task Operations", href: "/task-operations", icon: ListTodo, testId: "link-task-operations" },
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
  showBadge?: boolean;
}

interface NavSection {
  section: string;
  items: NavItem[];
}

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const [isHelpExpanded, setIsHelpExpanded] = useState(false);
  
  // Fetch team members from API with presence (refresh every 30s)
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
    enabled: !!user,
    refetchInterval: 30000,
  });
  
  // Fetch unread message count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread/count"],
    enabled: !!user,
    refetchInterval: 10000,
  });
  
  const unreadCount = unreadData?.count || 0;

  const isActive = (href: string) => location === href;
  
  // Use the isStaffRole helper from schema
  const userRole = user?.role || "";
  const isStaff = isStaffRole(userRole);
  const isAdmin = userRole === "admin";
  const isAspiringOwner = userRole === "aspiring_owner";
  
  // Fetch pending task count for borrowers
  const { data: pendingTasksData } = useQuery<{ pendingCount: number }>({
    queryKey: ["/api/task-engine/my-tasks/pending-count"],
    enabled: !!user && !isStaff,
    refetchInterval: 30000,
  });
  
  const pendingTaskCount = pendingTasksData?.pendingCount || 0;

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

  // Check which team roles are missing
  const assignedRoles = teamMembers.map(m => m.role);
  const missingRoles = EXPECTED_TEAM_ROLES.filter(role => !assignedRoles.includes(role));
  const hasMissingTeamMembers = missingRoles.length > 0;

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
                        {item.showBadge && pendingTaskCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-medium text-white" data-testid="badge-pending-tasks">
                            {pendingTaskCount > 99 ? '99+' : pendingTaskCount}
                          </span>
                        )}
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

        {/* Messages Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Communication</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/messages") || location.startsWith("/messages/")}>
                  <Link href="/messages" className="cursor-pointer" data-testid="link-messages">
                    <MessageCircle className="h-4 w-4" />
                    <span>Messages</span>
                    {unreadCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground" data-testid="badge-unread-count">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {/* Help & Learn section for clients with team dropdown */}
        {!isStaff && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Help with Team Dropdown */}
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    onClick={() => setIsHelpExpanded(!isHelpExpanded)}
                    data-testid="button-help-toggle"
                  >
                    <HelpCircle className="h-4 w-4" />
                    <span>Help</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      {hasMissingTeamMembers && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700" data-testid="badge-help-incomplete">
                          Incomplete
                        </Badge>
                      )}
                      {isHelpExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </SidebarMenuButton>
                  {isHelpExpanded && (
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">Your Team</div>
                      </SidebarMenuSubItem>
                      {teamMembers.length > 0 ? (
                        teamMembers.map((member) => (
                          <SidebarMenuSubItem key={member.id}>
                            <SidebarMenuSubButton asChild>
                              <Link 
                                href={`/messages/${member.id}`} 
                                className="cursor-pointer flex items-center gap-2"
                                data-testid={`link-help-team-${member.id}`}
                              >
                                <div className="relative">
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                      {member.initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <Circle 
                                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-current ${getStatusColor(member.presenceStatus)}`}
                                  />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm truncate">{member.name}</span>
                                  <span className="text-xs text-muted-foreground truncate">{ROLE_DISPLAY_NAMES[member.role] || member.role}</span>
                                </div>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))
                      ) : (
                        <SidebarMenuSubItem>
                          <div className="px-2 py-2 flex items-center gap-2 text-sm text-muted-foreground">
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                            <span>No team assigned yet</span>
                          </div>
                        </SidebarMenuSubItem>
                      )}
                      {missingRoles.length > 0 && teamMembers.length > 0 && (
                        <>
                          <SidebarMenuSubItem>
                            <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium border-t mt-1 pt-2">Pending Assignment</div>
                          </SidebarMenuSubItem>
                          {missingRoles.map((role) => (
                            <SidebarMenuSubItem key={role}>
                              <div className="px-2 py-1.5 flex items-center gap-2 text-sm text-muted-foreground">
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                </div>
                                <span>{ROLE_DISPLAY_NAMES[role] || role}</span>
                                <Badge variant="outline" className="ml-auto text-[10px] text-amber-600 border-amber-300">
                                  TBD
                                </Badge>
                              </div>
                            </SidebarMenuSubItem>
                          ))}
                        </>
                      )}
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <Link href="/staff" className="cursor-pointer" data-testid="link-contact-staff">
                            <Users className="h-4 w-4" />
                            <span>Contact Staff</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>

                {/* Learn - Links to Resources page */}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/resources")}>
                    <Link href="/resources" className="cursor-pointer" data-testid="link-learn">
                      <GraduationCap className="h-4 w-4" />
                      <span>Learn</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
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
