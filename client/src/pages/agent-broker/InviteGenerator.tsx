import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ApplicationInvite } from "@shared/schema";
import {
  Link2,
  Copy,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Users,
  Mail,
  Phone,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

const inviteFormSchema = z.object({
  clientName: z.string().optional(),
  clientEmail: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  clientPhone: z.string().optional(),
  message: z.string().optional(),
  expiresInDays: z.number().min(1).max(90).default(30),
});

type InviteFormValues = z.infer<typeof inviteFormSchema>;

interface InviteWithStatus extends ApplicationInvite {
  isExpired: boolean;
}

export default function InviteGenerator() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      message: "",
      expiresInDays: 30,
    },
  });

  const { data: invites, isLoading: invitesLoading } = useQuery<InviteWithStatus[]>({
    queryKey: ["/api/application-invites"],
    enabled: !!user,
  });

  const createInviteMutation = useMutation({
    mutationFn: async (data: InviteFormValues) => {
      const response = await apiRequest("POST", "/api/application-invites", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/application-invites"] });
      setGeneratedLink(data.inviteUrl);
      toast({
        title: "Invite link created",
        description: "Copy the link to send to your client.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invite link.",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: "Link copied to clipboard.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy link.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = (data: InviteFormValues) => {
    createInviteMutation.mutate(data);
  };

  const resetAndClose = () => {
    form.reset();
    setGeneratedLink(null);
    setIsDialogOpen(false);
  };

  const getStatusBadge = (invite: InviteWithStatus) => {
    if (invite.isExpired) {
      return <Badge variant="secondary" data-testid={`badge-status-expired-${invite.id}`}><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
    }
    switch (invite.status) {
      case "applied":
        return <Badge variant="default" data-testid={`badge-status-applied-${invite.id}`}><CheckCircle2 className="w-3 h-3 mr-1" />Applied</Badge>;
      case "clicked":
        return <Badge variant="secondary" data-testid={`badge-status-clicked-${invite.id}`}><ExternalLink className="w-3 h-3 mr-1" />Clicked</Badge>;
      default:
        return <Badge variant="outline" data-testid={`badge-status-pending-${invite.id}`}><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const isLoading = authLoading || invitesLoading;

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="mb-8 h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="mt-8 h-64" />
      </div>
    );
  }

  const stats = {
    total: invites?.length || 0,
    pending: invites?.filter(i => i.status === "pending" && !i.isExpired).length || 0,
    clicked: invites?.filter(i => i.status === "clicked").length || 0,
    applied: invites?.filter(i => i.status === "applied").length || 0,
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client Invite Links</h1>
          <p className="text-muted-foreground">
            Generate personalized application links to send to your affluent clients
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-invite">
              <Plus className="w-4 h-4 mr-2" />
              Create Invite Link
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Client Invite</DialogTitle>
              <DialogDescription>
                Generate a personalized link to send to your client via email or text.
              </DialogDescription>
            </DialogHeader>
            {generatedLink ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground mb-2">Share this link with your client:</p>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={generatedLink} 
                      readOnly 
                      className="flex-1 text-xs"
                      data-testid="input-generated-link"
                    />
                    <Button 
                      size="icon" 
                      variant="outline" 
                      onClick={() => copyToClipboard(generatedLink)}
                      data-testid="button-copy-link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={resetAndClose} data-testid="button-done">
                    Done
                  </Button>
                  <Button 
                    onClick={() => {
                      form.reset();
                      setGeneratedLink(null);
                    }}
                    data-testid="button-create-another"
                  >
                    Create Another
                  </Button>
                </div>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="clientName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Name (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="John Smith" 
                            {...field} 
                            data-testid="input-client-name"
                          />
                        </FormControl>
                        <FormDescription>
                          Pre-fill the client's name for a personalized experience
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="clientEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Email (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="john@example.com" 
                            {...field}
                            data-testid="input-client-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="clientPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Phone (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="tel" 
                            placeholder="(555) 123-4567" 
                            {...field}
                            data-testid="input-client-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal Message (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Looking forward to helping you with your mortgage!" 
                            {...field}
                            data-testid="input-message"
                          />
                        </FormControl>
                        <FormDescription>
                          This message will be shown when the client opens the link
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="expiresInDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Link Valid For</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            max={90}
                            {...field}
                            onChange={e => field.onChange(parseInt(e.target.value) || 30)}
                            data-testid="input-expires-days"
                          />
                        </FormControl>
                        <FormDescription>Days until the link expires (1-90)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={resetAndClose}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createInviteMutation.isPending}
                      data-testid="button-generate-link"
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      {createInviteMutation.isPending ? "Generating..." : "Generate Link"}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invites</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-invites">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All-time invites created</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-invites">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting client action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clicked</CardTitle>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-clicked-invites">{stats.clicked}</div>
            <p className="text-xs text-muted-foreground">Links opened by clients</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Applied</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-applied-invites">{stats.applied}</div>
            <p className="text-xs text-muted-foreground">Completed applications</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invite History</CardTitle>
          <CardDescription>Track all your client invite links</CardDescription>
        </CardHeader>
        <CardContent>
          {invites && invites.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id} data-testid={`row-invite-${invite.id}`}>
                    <TableCell className="font-medium">
                      {invite.clientName || <span className="text-muted-foreground">Not specified</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {invite.clientEmail && (
                          <span className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            {invite.clientEmail}
                          </span>
                        )}
                        {invite.clientPhone && (
                          <span className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            {invite.clientPhone}
                          </span>
                        )}
                        {!invite.clientEmail && !invite.clientPhone && (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(invite)}</TableCell>
                    <TableCell className="text-sm">
                      {invite.createdAt ? format(new Date(invite.createdAt), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {invite.expiresAt ? format(new Date(invite.expiresAt), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      {!invite.isExpired && invite.status !== "applied" && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => copyToClipboard(`${window.location.origin}/apply/${invite.token}`)}
                          data-testid={`button-copy-${invite.id}`}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy Link
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No invites yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first invite link to send to a client
              </p>
              <Button onClick={() => setIsDialogOpen(true)} data-testid="button-create-first-invite">
                <Plus className="w-4 h-4 mr-2" />
                Create Invite Link
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
