import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Send,
  Bot,
  User,
  Target,
  FileText,
  TrendingUp,
  Shield,
  Clock,
  CheckCircle2,
  Circle,
  Sparkles,
  ArrowRight,
  MessageSquare,
  ChevronRight,
  Plus,
  Loader2,
} from "lucide-react";

interface CoachMessage {
  id: string;
  role: string;
  content: string;
  structuredData?: any;
  createdAt: string;
}

interface CoachConversation {
  id: string;
  title: string;
  readinessTier: string | null;
  readinessScore: number | null;
  financialProfile: any;
  actionPlan: any;
  documentChecklist: any;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface CoachProfile {
  readinessTier: string;
  readinessScore: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendedLoanTypes: string[];
  estimatedTimeline: string;
}

interface ActionPlanItem {
  id: string;
  phase: number;
  title: string;
  description: string;
  priority: string;
  category: string;
  completed: boolean;
}

interface DocumentRequirement {
  docType: string;
  label: string;
  reason: string;
  priority: string;
  category: string;
}

const TIER_CONFIG: Record<string, { label: string; color: string; icon: typeof Target }> = {
  ready_now: { label: "Ready Now", color: "bg-emerald-500", icon: CheckCircle2 },
  almost_ready: { label: "Almost Ready", color: "bg-blue-500", icon: TrendingUp },
  building: { label: "Building", color: "bg-amber-500", icon: Target },
  exploring: { label: "Exploring", color: "bg-slate-500", icon: Clock },
};

const CATEGORY_ICONS: Record<string, typeof Target> = {
  credit: Shield,
  savings: TrendingUp,
  income: Target,
  debt: FileText,
  documents: FileText,
  education: Sparkles,
};

function ReadinessPanel({ profile }: { profile: CoachProfile }) {
  const tier = TIER_CONFIG[profile.readinessTier] || TIER_CONFIG.exploring;
  const TierIcon = tier.icon;

  return (
    <Card data-testid="card-readiness-panel">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4 text-primary" />
          Your Readiness Assessment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`p-2 rounded-lg ${tier.color}/10`}>
            <TierIcon className={`h-5 w-5 ${tier.color.replace("bg-", "text-")}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground" data-testid="text-readiness-tier">{tier.label}</span>
              <Badge variant="secondary" className="text-xs" data-testid="badge-readiness-score">
                {profile.readinessScore}/100
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{profile.estimatedTimeline}</p>
          </div>
        </div>
        <Progress value={profile.readinessScore} className="h-2" data-testid="progress-readiness" />
        <p className="text-sm text-muted-foreground" data-testid="text-readiness-summary">{profile.summary}</p>

        {profile.strengths.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">STRENGTHS</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.strengths.map((s, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {profile.gaps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">AREAS TO IMPROVE</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.gaps.map((g, i) => (
                <Badge key={i} variant="outline" className="text-xs font-normal">
                  {g}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {profile.recommendedLoanTypes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">RECOMMENDED LOAN TYPES</p>
            <div className="flex flex-wrap gap-1.5">
              {profile.recommendedLoanTypes.map((lt, i) => (
                <Badge key={i} variant="default" className="text-xs">
                  {lt.toUpperCase()}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionPlanPanel({ plan }: { plan: ActionPlanItem[] }) {
  const completedCount = plan.filter(a => a.completed).length;

  return (
    <Card data-testid="card-action-plan">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Your Action Plan
          </span>
          <Badge variant="secondary" className="text-xs">
            {completedCount}/{plan.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {plan.map((item) => {
            const CatIcon = CATEGORY_ICONS[item.category] || Target;
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 p-2.5 rounded-lg border ${
                  item.completed ? "bg-muted/50 border-muted" : "border-border"
                }`}
                data-testid={`action-item-${item.id}`}
              >
                {item.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${item.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                      {item.title}
                    </span>
                    <Badge
                      variant={item.priority === "high" ? "destructive" : item.priority === "medium" ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {item.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                </div>
                <CatIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentChecklistPanel({ docs }: { docs: DocumentRequirement[] }) {
  const grouped = docs.reduce((acc, d) => {
    const cat = d.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(d);
    return acc;
  }, {} as Record<string, DocumentRequirement[]>);

  return (
    <Card data-testid="card-document-checklist">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          <FileText className="h-4 w-4 text-primary" />
          Your Document Checklist
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{category}</p>
              <div className="space-y-1.5">
                {items.map((doc, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-2 rounded-lg hover-elevate" data-testid={`doc-item-${doc.docType}`}>
                    <Circle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-foreground">{doc.label}</span>
                        <Badge
                          variant={doc.priority === "required" ? "destructive" : doc.priority === "recommended" ? "default" : "secondary"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {doc.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{doc.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ChatMessage({ message }: { message: CoachMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`} data-testid={`chat-message-${message.id}`}>
      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
        isUser ? "bg-primary text-primary-foreground" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      }`}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`flex-1 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div className={`inline-block text-left rounded-xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}>
          <MessageContent content={message.content} />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 px-1">
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        const lines = part.split("\n");
        return lines.map((line, j) => (
          <span key={`${i}-${j}`}>
            {j > 0 && <br />}
            {line}
          </span>
        ));
      })}
    </>
  );
}

function WelcomeState({ onStart }: { onStart: (msg: string) => void }) {
  const starters = [
    { label: "I want to buy my first home", icon: Target },
    { label: "Am I ready for a mortgage?", icon: TrendingUp },
    { label: "What documents do I need?", icon: FileText },
    { label: "How can I improve my credit for a mortgage?", icon: Shield },
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <Sparkles className="h-7 w-7 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground" data-testid="text-coach-welcome">
            AI Homebuyer Coach
          </h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            I'll help you understand where you stand financially, create a personalized action plan,
            and tell you exactly which documents you'll need for your mortgage application.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {starters.map((s) => (
            <Button
              key={s.label}
              variant="outline"
              className="justify-start gap-2 text-left h-auto py-3"
              onClick={() => onStart(s.label)}
              data-testid={`button-starter-${s.label.substring(0, 15).replace(/\s/g, '-').toLowerCase()}`}
            >
              <s.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="text-sm">{s.label}</span>
              <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
}: {
  conversations: CoachConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 mb-2"
        onClick={onNew}
        data-testid="button-new-conversation"
      >
        <Plus className="h-3.5 w-3.5" />
        New Conversation
      </Button>
      {conversations.map((c) => {
        const tier = c.readinessTier ? TIER_CONFIG[c.readinessTier] : null;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left p-2.5 rounded-lg text-sm transition-colors ${
              activeId === c.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "hover-elevate text-foreground"
            }`}
            data-testid={`button-conversation-${c.id}`}
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">{c.title || "New Chat"}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 ml-5.5">
              {tier && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tier.label}
                </Badge>
              )}
              <span className="text-[10px] text-muted-foreground">
                {new Date(c.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function AICoach() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversations = [], isLoading: loadingConvs } = useQuery<CoachConversation[]>({
    queryKey: ["/api/coach/conversations"],
  });

  const { data: activeData, isLoading: loadingMessages } = useQuery<{
    conversation: CoachConversation;
    messages: CoachMessage[];
  }>({
    queryKey: ["/api/coach/conversations", activeConversationId],
    enabled: !!activeConversationId,
  });

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/coach/message", {
        message,
        conversationId: activeConversationId || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.conversationId && !activeConversationId) {
        setActiveConversationId(data.conversationId);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/coach/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coach/conversations", data.conversationId || activeConversationId] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeData?.messages]);

  const handleSend = () => {
    const msg = inputValue.trim();
    if (!msg || sendMessage.isPending) return;
    setInputValue("");
    sendMessage.mutate(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const messages = activeData?.messages || [];
  const activeConv = activeData?.conversation;
  const profile = activeConv?.financialProfile as CoachProfile | null;
  const actionPlan = activeConv?.actionPlan as ActionPlanItem[] | null;
  const documentChecklist = activeConv?.documentChecklist as DocumentRequirement[] | null;
  const hasSidePanel = profile || actionPlan || documentChecklist;

  return (
    <div className="flex h-[calc(100vh-4rem)]" data-testid="page-ai-coach">
      {showSidebar && (
        <div className="w-64 border-r p-3 overflow-y-auto hidden lg:block">
          <div className="flex items-center gap-2 mb-4 px-1">
            <Bot className="h-5 w-5 text-emerald-500" />
            <h2 className="font-semibold text-foreground text-sm">AI Coach</h2>
          </div>
          {loadingConvs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ConversationList
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={setActiveConversationId}
              onNew={() => setActiveConversationId(null)}
            />
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {!activeConversationId && messages.length === 0 ? (
          <WelcomeState onStart={(msg) => {
            setInputValue("");
            sendMessage.mutate(msg);
          }} />
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="chat-messages-container">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {sendMessage.isPending && (
              <div className="flex gap-3">
                <div className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-muted rounded-xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        <div className="border-t p-3">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your mortgage readiness, documents, credit..."
              className="resize-none min-h-[44px] max-h-[120px] text-sm"
              rows={1}
              disabled={sendMessage.isPending}
              data-testid="input-coach-message"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!inputValue.trim() || sendMessage.isPending}
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {hasSidePanel && (
        <div className="w-80 border-l overflow-y-auto p-3 space-y-3 hidden xl:block" data-testid="coach-side-panel">
          {profile && <ReadinessPanel profile={profile} />}
          {actionPlan && actionPlan.length > 0 && <ActionPlanPanel plan={actionPlan} />}
          {documentChecklist && documentChecklist.length > 0 && <DocumentChecklistPanel docs={documentChecklist} />}
        </div>
      )}
    </div>
  );
}
