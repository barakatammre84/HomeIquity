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
} from "lucide-react";

const navigationItems = [
  {
    section: "Main",
    items: [
      { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { title: "Application Summary", href: "/application-summary", icon: FileText },
      { title: "Tasks", href: "/tasks", icon: CheckSquare },
    ],
  },
  {
    section: "Loans & Documents",
    items: [
      { title: "URLA Form", href: "/urla-form", icon: Clipboard },
      { title: "Documents", href: "/documents", icon: Upload },
    ],
  },
  {
    section: "Support",
    items: [
      { title: "Resources", href: "/resources", icon: BookOpen },
      { title: "Staff", href: "/staff", icon: Users },
    ],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const isActive = (href: string) => location === href;

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-4">
          <p className="text-sm font-semibold">Better</p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {navigationItems.map((section) => (
          <SidebarGroup key={section.section}>
            <SidebarGroupLabel>{section.section}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={`${section.section}-${item.title}`}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)}>
                      <Link href={item.href} className="cursor-pointer">
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

        {["admin", "lender", "broker"].includes(user?.role || "") && (
          <SidebarGroup>
            <SidebarGroupLabel>Staff</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/pipeline-queue")}>
                    <Link href="/pipeline-queue" className="cursor-pointer" data-testid="link-pipeline-queue">
                      <GitBranch className="h-4 w-4" />
                      <span>Pipeline Queue</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/staff-dashboard")}>
                    <Link href="/staff-dashboard" className="cursor-pointer" data-testid="link-staff-dashboard">
                      <CheckSquare className="h-4 w-4" />
                      <span>Task Management</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {user?.role === "admin" && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/admin")}>
                      <Link href="/admin" className="cursor-pointer">
                        <Users className="h-4 w-4" />
                        <span>Admin Panel</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/api/logout" className="cursor-pointer">
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
