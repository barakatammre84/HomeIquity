import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  MoreHorizontal,
  Shield,
  UserCog,
  Users,
  Briefcase,
  Building2,
  Home,
  AlertCircle,
  Filter,
  UserCheck,
  FileCheck,
  ClipboardCheck,
  Banknote,
  Wrench,
  Star,
} from "lucide-react";
import { format } from "date-fns";
import { 
  ALL_ROLES, 
  STAFF_ROLES, 
  CLIENT_ROLES,
  ROLE_DISPLAY_NAMES, 
  ROLE_DESCRIPTIONS,
  isStaffRole,
  type UserRole 
} from "@shared/schema";

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: string;
  isPartner?: boolean;
  partnerCompanyName?: string | null;
  nmlsId?: string | null;
  createdAt: string | null;
}

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Shield; color: string }> = {
  // Staff roles
  admin: { label: "Tech/Ops Lead", icon: Wrench, color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  lo: { label: "Loan Officer", icon: UserCheck, color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  loa: { label: "LOA", icon: Briefcase, color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200" },
  processor: { label: "Processor", icon: FileCheck, color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  underwriter: { label: "Underwriter", icon: ClipboardCheck, color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  closer: { label: "Closer/Funder", icon: Banknote, color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  // Client roles
  aspiring_owner: { label: "Aspiring Owner", icon: Star, color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  active_buyer: { label: "Active Buyer", icon: Home, color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
};

const ROLES = ALL_ROLES;

export default function AdminUsers() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!currentUser && currentUser.role === "admin",
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User role updated successfully" });
      setEditDialogOpen(false);
      setSelectedUser(null);
    },
    onError: () => {
      toast({ title: "Failed to update user role", variant: "destructive" });
    },
  });

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setEditDialogOpen(true);
  };

  const handleUpdateRole = () => {
    if (selectedUser && newRole) {
      updateRoleMutation.mutate({ userId: selectedUser.id, role: newRole });
    }
  };

  const getInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const getDisplayName = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email || "Unknown User";
  };

  const filteredUsers = users?.filter((user) => {
    const matchesSearch =
      !searchTerm ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const userStats = {
    total: users?.length || 0,
    // Staff roles
    admins: users?.filter((u) => u.role === "admin").length || 0,
    loanOfficers: users?.filter((u) => u.role === "lo").length || 0,
    loas: users?.filter((u) => u.role === "loa").length || 0,
    processors: users?.filter((u) => u.role === "processor").length || 0,
    underwriters: users?.filter((u) => u.role === "underwriter").length || 0,
    closers: users?.filter((u) => u.role === "closer").length || 0,
    // Client roles
    aspiringOwners: users?.filter((u) => u.role === "aspiring_owner").length || 0,
    activeBuyers: users?.filter((u) => u.role === "active_buyer").length || 0,
    // Aggregates
    totalStaff: users?.filter((u) => isStaffRole(u.role)).length || 0,
    totalClients: users?.filter((u) => !isStaffRole(u.role)).length || 0,
  };

  if (authLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (currentUser?.role !== "admin") {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md" data-testid="card-access-denied">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold" data-testid="text-access-denied">Access Denied</h2>
            <p className="text-muted-foreground mt-2">
              You don't have permission to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">User Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage user accounts and assign roles
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-users">{userStats.total}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-admins">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900">
                <Wrench className="h-5 w-5 text-red-600 dark:text-red-300" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-admin-count">{userStats.admins}</p>
                <p className="text-sm text-muted-foreground">Tech/Ops Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-staff">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-staff-count">{userStats.totalStaff}</p>
                <p className="text-sm text-muted-foreground">Staff Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-clients">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <Home className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-client-count">{userStats.totalClients}</p>
                <p className="text-sm text-muted-foreground">Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Role Breakdown */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
        <Card className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className="text-center">
              <p className="text-xl font-bold" data-testid="text-lo-count">{userStats.loanOfficers}</p>
              <p className="text-xs text-muted-foreground">Loan Officers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className="text-center">
              <p className="text-xl font-bold" data-testid="text-loa-count">{userStats.loas}</p>
              <p className="text-xs text-muted-foreground">LOAs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className="text-center">
              <p className="text-xl font-bold" data-testid="text-processor-count">{userStats.processors}</p>
              <p className="text-xs text-muted-foreground">Processors</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className="text-center">
              <p className="text-xl font-bold" data-testid="text-underwriter-count">{userStats.underwriters}</p>
              <p className="text-xs text-muted-foreground">Underwriters</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className="text-center">
              <p className="text-xl font-bold" data-testid="text-closer-count">{userStats.closers}</p>
              <p className="text-xs text-muted-foreground">Closers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className="text-center border-l-2 border-muted pl-2">
              <p className="text-xl font-bold" data-testid="text-aspiring-count">{userStats.aspiringOwners}</p>
              <p className="text-xs text-muted-foreground">Aspiring</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className="text-center">
              <p className="text-xl font-bold" data-testid="text-active-buyer-count">{userStats.activeBuyers}</p>
              <p className="text-xs text-muted-foreground">Active Buyers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>All Users</CardTitle>
              <CardDescription>View and manage user accounts</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                  data-testid="input-search-users"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-36" data-testid="select-role-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_CONFIG[role].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {usersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredUsers && filteredUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const roleConfig = ROLE_CONFIG[user.role] || ROLE_CONFIG.active_buyer;
                  const RoleIcon = roleConfig.icon;
                  const isCurrentUser = user.id === currentUser?.id;

                  return (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.profileImageUrl || undefined} />
                            <AvatarFallback>{getInitials(user)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{getDisplayName(user)}</p>
                            {isCurrentUser && (
                              <Badge variant="outline" className="text-xs">You</Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email || "No email"}
                      </TableCell>
                      <TableCell>
                        <Badge className={roleConfig.color}>
                          <RoleIcon className="h-3 w-3 mr-1" />
                          {roleConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.createdAt
                          ? format(new Date(user.createdAt), "MMM d, yyyy")
                          : "Unknown"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              data-testid={`button-actions-${user.id}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openEditDialog(user)}
                              disabled={isCurrentUser}
                              data-testid={`button-change-role-${user.id}`}
                            >
                              <UserCog className="h-4 w-4 mr-2" />
                              Change Role
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm || roleFilter !== "all"
                  ? "No users match your search criteria"
                  : "No users found"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedUser ? getDisplayName(selectedUser) : "this user"}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-4 mb-6 p-4 rounded-lg bg-muted">
              <Avatar className="h-12 w-12">
                <AvatarImage src={selectedUser?.profileImageUrl || undefined} />
                <AvatarFallback>{selectedUser ? getInitials(selectedUser) : "U"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{selectedUser ? getDisplayName(selectedUser) : ""}</p>
                <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Select New Role</label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger data-testid="select-new-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => {
                    const config = ROLE_CONFIG[role];
                    const Icon = config.icon;
                    return (
                      <SelectItem key={role} value={role}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} data-testid="button-cancel-role">
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={updateRoleMutation.isPending || newRole === selectedUser?.role}
              data-testid="button-save-role"
            >
              {updateRoleMutation.isPending ? "Saving..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
