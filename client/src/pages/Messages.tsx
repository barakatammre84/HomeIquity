import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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

// Mock team members data - should match sidebar
const teamMembers: Record<string, { id: string; name: string; role: string; initials: string; status: string }> = {
  "lo-1": { id: "lo-1", name: "Sarah Johnson", role: "Loan Officer", initials: "SJ", status: "online" },
  "proc-1": { id: "proc-1", name: "Mike Chen", role: "Processor", initials: "MC", status: "online" },
  "uw-1": { id: "uw-1", name: "Emily Davis", role: "Underwriter", initials: "ED", status: "away" },
  "closer-1": { id: "closer-1", name: "James Wilson", role: "Closer", initials: "JW", status: "offline" },
};

// Mock conversation data
const mockConversations: Record<string, Array<{ id: string; sender: "user" | "team"; message: string; timestamp: Date; read: boolean }>> = {
  "lo-1": [
    { id: "1", sender: "team", message: "Hi! I'm Sarah, your dedicated Loan Officer. How can I help you today?", timestamp: new Date(Date.now() - 86400000), read: true },
    { id: "2", sender: "user", message: "Hi Sarah! I had a question about my pre-approval letter.", timestamp: new Date(Date.now() - 82800000), read: true },
    { id: "3", sender: "team", message: "Of course! I'd be happy to help. What would you like to know?", timestamp: new Date(Date.now() - 79200000), read: true },
    { id: "4", sender: "user", message: "The letter shows a different loan amount than I expected. Can you explain?", timestamp: new Date(Date.now() - 3600000), read: true },
    { id: "5", sender: "team", message: "Great question! The pre-approval amount is based on your verified income and current DTI ratio. Would you like to schedule a call to go over the details?", timestamp: new Date(Date.now() - 1800000), read: true },
  ],
  "proc-1": [
    { id: "1", sender: "team", message: "Hello! I'm Mike, your Processor. I'll be helping manage your loan file.", timestamp: new Date(Date.now() - 172800000), read: true },
    { id: "2", sender: "user", message: "Thanks Mike! What documents do you still need from me?", timestamp: new Date(Date.now() - 169200000), read: true },
    { id: "3", sender: "team", message: "I've reviewed your file. We still need your most recent bank statement and proof of employment. You can upload them in the Documents section.", timestamp: new Date(Date.now() - 165600000), read: true },
  ],
  "uw-1": [
    { id: "1", sender: "team", message: "Hi, I'm Emily from underwriting. I'll be reviewing your loan application.", timestamp: new Date(Date.now() - 259200000), read: true },
  ],
  "closer-1": [],
};

function formatMessageTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  
  if (days === 0) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } else if (days === 1) {
    return "Yesterday";
  } else if (days < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const [conversations, setConversations] = useState(mockConversations);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const selectedMember = memberId ? teamMembers[memberId] : null;
  const currentConversation = memberId ? conversations[memberId] || [] : [];

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [currentConversation]);

  const handleSendMessage = () => {
    if (!message.trim() || !memberId) return;
    
    const newMessage = {
      id: Date.now().toString(),
      sender: "user" as const,
      message: message.trim(),
      timestamp: new Date(),
      read: false,
    };
    
    setConversations(prev => ({
      ...prev,
      [memberId]: [...(prev[memberId] || []), newMessage],
    }));
    setMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // If no member selected, show conversation list
  if (!selectedMember) {
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
              <div className="divide-y">
                {Object.values(teamMembers).map((member) => {
                  const lastMessage = conversations[member.id]?.[conversations[member.id].length - 1];
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
                            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 fill-current ${getStatusColor(member.status)}`}
                            data-testid={`status-indicator-${member.id}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium" data-testid={`text-member-name-${member.id}`}>{member.name}</span>
                            {lastMessage && (
                              <span className="text-xs text-muted-foreground" data-testid={`text-timestamp-${member.id}`}>
                                {formatMessageTime(lastMessage.timestamp)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs shrink-0" data-testid={`badge-role-${member.id}`}>
                              {member.role}
                            </Badge>
                            {lastMessage && (
                              <span className="text-sm text-muted-foreground truncate" data-testid={`text-last-message-${member.id}`}>
                                {lastMessage.sender === "user" ? "You: " : ""}{lastMessage.message}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
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
            <div className="relative">
              <Avatar className="h-10 w-10" data-testid="avatar-chat-member">
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {selectedMember.initials}
                </AvatarFallback>
              </Avatar>
              <Circle 
                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 fill-current ${getStatusColor(selectedMember.status)}`}
                data-testid="status-chat-member"
              />
            </div>
            <div>
              <h2 className="font-semibold" data-testid="text-chat-member-name">{selectedMember.name}</h2>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span data-testid="text-chat-member-role">{selectedMember.role}</span>
                <span>•</span>
                <span className={getStatusColor(selectedMember.status)} data-testid="text-chat-member-status">
                  {getStatusText(selectedMember.status)}
                </span>
              </div>
            </div>
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
          {currentConversation.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-conversation">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium" data-testid="text-empty-title">Start a conversation</h3>
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-empty-description">
                Send a message to {selectedMember.name} to get started
              </p>
            </div>
          ) : (
            currentConversation.map((msg, index) => {
              const isUser = msg.sender === "user";
              const showTimestamp = index === 0 || 
                (new Date(currentConversation[index - 1].timestamp).getTime() - msg.timestamp.getTime()) > 300000;
              
              return (
                <div key={msg.id}>
                  {showTimestamp && (
                    <div className="flex justify-center my-4">
                      <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {formatMessageTime(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className={`flex items-end gap-2 max-w-[80%] ${isUser ? "flex-row-reverse" : ""}`}>
                      {!isUser && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {selectedMember.initials}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={`px-4 py-2.5 rounded-2xl ${
                          isUser
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        }`}
                        data-testid={`message-${msg.id}`}
                      >
                        <p className="text-sm">{msg.message}</p>
                      </div>
                      {isUser && msg.read && (
                        <CheckCheck className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  </div>
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
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
            data-testid="input-message"
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!message.trim()}
            data-testid="button-send"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
