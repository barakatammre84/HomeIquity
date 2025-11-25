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
  Home,
  BookOpen,
  Upload,
  Users,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
      { title: "My Loans", href: "/my-loans", icon: Home },
      { title: "Documents", href: "/documents", icon: Upload },
    ],
  },
  {
    section: "Resources",
    items: [
      { title: "Resources", href: "/resources", icon: BookOpen },
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
                  <SidebarMenuItem key={item.href}>
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

        {user?.role === "admin" && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/admin")}>
                    <Link href="/admin" className="cursor-pointer">
                      <Users className="h-4 w-4" />
                      <span>Admin Panel</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
