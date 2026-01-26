import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Send,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  ArrowLeft,
  Circle,
  MessageCircle,
  Clock,
  CheckCheck,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { TeamMessage } from "@shared/schema";

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string | null;
  profileImageUrl: string | null;
  initials: string;
}

interface ConversationData {
  partnerId: string;
  lastMessage: TeamMessage;
  unreadCount: number;
  partner: TeamMember | null;
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin: "Tech/Ops Lead",
  lo: "Loan Officer",
  loa: "Loan Officer Assistant",
  processor: "Processor",
  underwriter: "Underwriter",
  closer: "Closer/Funder",
  aspiring_owner: "Aspiring Owner",
  active_buyer: "Active Buyer",
};

function formatMessageTime(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86400000);
  
  if (days === 0) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    return d.toLocaleDateString("en-US", { weekday: "short" });
  } else {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "online": return "text-emerald-500";
    case "away": return "text-amber-500";
    default: return "text-muted-foreground";
  }
}

function getStatusText(status: string) {
  switch (status) {
    case "online": return "Online";
    case "away": return "Away";
    default: return "Offline";
  }
}

export default function Messages() {
  const params = useParams<{ memberId?: string }>();
  const memberId = params.memberId;
  const [message, setMessage] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch team members
  const { data: teamMembers = [], isLoading: isLoadingTeam } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  // Fetch conversations for list view
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery<ConversationData[]>({
    queryKey: ["/api/messages/conversations"],
  });

  // Fetch messages for the selected team member
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<TeamMessage[]>({
    queryKey: ["/api/messages", memberId],
    enabled: !!memberId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { recipientId: string; message: string }) => {
      const response = await apiRequest("POST", "/api/messages", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages", memberId] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
    },
  });

  // Find selected member
  const selectedMember = memberId 
    ? teamMembers.find(m => m.id === memberId) || null 
    : null;

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (!message.trim() || !memberId) return;
    
    sendMessageMutation.mutate({
      recipientId: memberId,
      message: message.trim(),
    });
    setMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Helper to get last message for a team member
  const getLastMessageForMember = (memberId: string) => {
    const conv = conversations.find(c => c.partnerId === memberId);
    return conv?.lastMessage;
  };

  // If no member selected, show conversation list
  if (!memberId) {
    return (
      <>
        {/* Premium Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

          <div className="relative px-6 py-8">
            <div className="flex items-center gap-2 text-primary-foreground/80 mb-2">
              <MessageCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Communication</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Messages
            </h1>
            <p className="mt-1 text-primary-foreground/80">
              Chat with your mortgage team
            </p>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:p-8 -mt-6">
          <Card className="shadow-lg border-0">
            <CardHeader>
              <CardTitle>Your Team</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingTeam ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground" data-testid="empty-team">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No team members assigned yet</p>
                  <p className="text-sm mt-1">Team members will appear here once assigned to your loan</p>
                </div>
              ) : (
                <div className="divide-y">
                  {teamMembers.map((member) => {
                    const lastMessage = getLastMessageForMember(member.id);
                    const conv = conversations.find(c => c.partnerId === member.id);
                    return (
                      <Link 
                        key={member.id} 
                        href={`/messages/${member.id}`}
                        data-testid={`link-conversation-${member.id}`}
                      >
                        <div 
                          className="flex items-center gap-4 p-4 cursor-pointer transition-colors hover-elevate"
                        >
                          <div className="relative">
                            <Avatar className="h-12 w-12" data-testid={`avatar-${member.id}`}>
                              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {member.initials}
                              </AvatarFallback>
                            </Avatar>
                            <Circle 
                              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-current text-muted-foreground"
                              data-testid={`status-indicator-${member.id}`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium" data-testid={`text-member-name-${member.id}`}>{member.name}</span>
                              {lastMessage && (
                                <span className="text-xs text-muted-foreground" data-testid={`text-timestamp-${member.id}`}>
                                  {formatMessageTime(lastMessage.createdAt!)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs shrink-0" data-testid={`badge-role-${member.id}`}>
                                {ROLE_DISPLAY_NAMES[member.role] || member.role}
                              </Badge>
                              {lastMessage && (
                                <span className="text-sm text-muted-foreground truncate" data-testid={`text-last-message-${member.id}`}>
                                  {lastMessage.message}
                                </span>
                              )}
                              {conv && conv.unreadCount > 0 && (
                                <Badge className="ml-auto shrink-0" data-testid={`badge-unread-${member.id}`}>
                                  {conv.unreadCount}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  // Chat view with selected member
  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="border-b bg-background">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link href="/messages">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            {isLoadingTeam || !selectedMember ? (
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Avatar className="h-10 w-10" data-testid="avatar-chat-member">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {selectedMember.initials}
                    </AvatarFallback>
                  </Avatar>
                  <Circle 
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current text-muted-foreground"
                    data-testid="status-chat-member"
                  />
                </div>
                <div>
                  <h2 className="font-semibold" data-testid="text-chat-member-name">{selectedMember.name}</h2>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span data-testid="text-chat-member-role">{ROLE_DISPLAY_NAMES[selectedMember.role] || selectedMember.role}</span>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" data-testid="button-call">
              <Phone className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" data-testid="button-video">
              <Video className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" data-testid="button-more">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4 max-w-3xl mx-auto">
          {isLoadingMessages ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                  <Skeleton className="h-16 w-64 rounded-lg" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-conversation">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium" data-testid="text-empty-title">Start a conversation</h3>
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-empty-description">
                Send a message to {selectedMember?.name || "this team member"} to get started
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isFromCurrentUser = msg.senderId !== memberId;
              const showTimestamp = index === 0 || 
                (new Date(msg.createdAt!).getTime() - new Date(messages[index - 1].createdAt!).getTime()) > 300000;

              return (
                <div key={msg.id}>
                  {showTimestamp && (
                    <div className="flex justify-center my-4">
                      <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                        {formatMessageTime(msg.createdAt!)}
                      </span>
                    </div>
                  )}
                  <div 
                    className={`flex ${isFromCurrentUser ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${msg.id}`}
                  >
                    <div className={`flex items-end gap-2 max-w-[80%] ${isFromCurrentUser ? "flex-row-reverse" : ""}`}>
                      {!isFromCurrentUser && selectedMember && (
                        <Avatar className="h-8 w-8 mb-1">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {selectedMember.initials}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div 
                        className={`rounded-2xl px-4 py-2 ${
                          isFromCurrentUser 
                            ? "bg-primary text-primary-foreground rounded-br-md" 
                            : "bg-muted rounded-bl-md"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  </div>
                  {isFromCurrentUser && (
                    <div className="flex justify-end mt-0.5 mr-1">
                      {msg.isRead ? (
                        <CheckCheck className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t bg-background p-4">
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          <Button variant="ghost" size="icon" data-testid="button-attach">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            className="flex-1"
            data-testid="input-message"
          />
          <Button 
            size="icon" 
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending}
            data-testid="button-send"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
