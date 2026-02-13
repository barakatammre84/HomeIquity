import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Upload,
  FileText,
  MessageCircle,
  Home,
  Sparkles,
  BookOpen,
  Calculator,
  Shield,
  Clock,
  Bot,
  CheckCircle2,
} from "lucide-react";
import type { LoanApplication } from "@shared/schema";

interface WhatsNextProps {
  application: LoanApplication | null;
  pendingTasks: number;
  pendingDocuments: number;
  unreadMessages: number;
}

interface NextAction {
  icon: typeof ArrowRight;
  iconColor: string;
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
  priority: number;
}

export function getNextActions(props: WhatsNextProps): NextAction[] {
  const { application, pendingTasks, pendingDocuments, unreadMessages } = props;
  const actions: NextAction[] = [];

  if (!application) {
    actions.push({
      icon: Sparkles,
      iconColor: "text-emerald-500",
      title: "Start your pre-approval",
      description: "Get pre-approved in as little as 3 minutes. No impact to your credit score.",
      href: "/apply",
      buttonLabel: "Get Started",
      priority: 1,
    });
    actions.push({
      icon: Calculator,
      iconColor: "text-blue-500",
      title: "See what you can afford",
      description: "Use our calculator to estimate your monthly payment and buying power.",
      href: "/calculators/affordability",
      buttonLabel: "Calculate",
      priority: 2,
    });
    actions.push({
      icon: BookOpen,
      iconColor: "text-purple-500",
      title: "Learn how mortgages work",
      description: "Browse guides and articles to prepare for your homebuying journey.",
      href: "/learn",
      buttonLabel: "Explore",
      priority: 3,
    });
    return actions;
  }

  const status = application.status;

  if (unreadMessages > 0) {
    actions.push({
      icon: MessageCircle,
      iconColor: "text-blue-500",
      title: `You have ${unreadMessages} unread message${unreadMessages > 1 ? "s" : ""}`,
      description: "Your loan team sent you a message. Respond to keep things moving.",
      href: "/messages",
      buttonLabel: "View Messages",
      priority: 1,
    });
  }

  if (pendingTasks > 0) {
    actions.push({
      icon: Upload,
      iconColor: "text-amber-500",
      title: `${pendingTasks} task${pendingTasks > 1 ? "s" : ""} need${pendingTasks === 1 ? "s" : ""} your attention`,
      description: "Complete your pending tasks to keep your application moving forward.",
      href: "/tasks",
      buttonLabel: "View Tasks",
      priority: 2,
    });
  }

  if (pendingDocuments > 0) {
    actions.push({
      icon: FileText,
      iconColor: "text-orange-500",
      title: `${pendingDocuments} document${pendingDocuments > 1 ? "s" : ""} still needed`,
      description: "Upload the remaining documents so we can continue reviewing your application.",
      href: "/documents",
      buttonLabel: "Upload Documents",
      priority: 3,
    });
  }

  if (status === "submitted" || status === "analyzing") {
    actions.push({
      icon: Clock,
      iconColor: "text-primary",
      title: "Your application is being reviewed",
      description: "We're analyzing your information. You'll hear back within minutes.",
      href: "/dashboard",
      buttonLabel: "View Status",
      priority: 5,
    });
  }

  if (status === "pre_approved") {
    if (actions.length === 0) {
      actions.push({
        icon: Home,
        iconColor: "text-emerald-500",
        title: "Browse homes in your budget",
        description: "You're pre-approved. Start exploring properties that fit your budget.",
        href: "/properties",
        buttonLabel: "Browse Properties",
        priority: 4,
      });
    }
    actions.push({
      icon: Shield,
      iconColor: "text-blue-500",
      title: "How we protect your data",
      description: "Learn about the security measures protecting your personal information.",
      href: "/privacy",
      buttonLabel: "Learn More",
      priority: 10,
    });
  }

  if (["doc_collection", "processing"].includes(status)) {
    if (pendingTasks === 0 && pendingDocuments === 0) {
      actions.push({
        icon: Clock,
        iconColor: "text-blue-500",
        title: "Your documents are being processed",
        description: "Our team is reviewing your documents. We'll reach out if we need anything else.",
        href: "/dashboard",
        buttonLabel: "View Status",
        priority: 4,
      });
    }
  }

  if (["underwriting", "conditional"].includes(status)) {
    actions.push({
      icon: Shield,
      iconColor: "text-primary",
      title: "Underwriting in progress",
      description: "A human underwriter is reviewing your file. This typically takes 1-3 business days.",
      href: "/dashboard",
      buttonLabel: "View Status",
      priority: 5,
    });
  }

  if (status === "clear_to_close" || status === "closing") {
    actions.push({
      icon: Sparkles,
      iconColor: "text-emerald-500",
      title: "You're almost there",
      description: "Your loan is clear to close. Your closer will reach out to schedule your signing.",
      href: "/messages",
      buttonLabel: "Contact Team",
      priority: 1,
    });
  }

  if (actions.length === 0) {
    actions.push({
      icon: BookOpen,
      iconColor: "text-purple-500",
      title: "Homebuying tips for you",
      description: "Browse expert guides about the mortgage process while you wait.",
      href: "/learn",
      buttonLabel: "Read Guides",
      priority: 10,
    });
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

export function WhatsNext(props: WhatsNextProps) {
  const actions = getNextActions(props);

  if (actions.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="whats-next">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        What's Next
      </h3>
      {actions.map((action, index) => {
        const Icon = action.icon;
        return (
          <Card key={index} className="hover-elevate" data-testid={`card-next-action-${index}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${action.iconColor}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" data-testid={`text-action-title-${index}`}>
                    {action.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {action.description}
                  </p>
                </div>
                <Link href={action.href} className="shrink-0">
                  <Button variant="ghost" size="sm" data-testid={`button-action-${index}`}>
                    {action.buttonLabel}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const ONBOARDING_STEPS = [
  {
    step: 1,
    icon: Bot,
    iconColor: "text-purple-500",
    bgColor: "bg-purple-500",
    title: "Meet your AI Coach",
    description: "Start a quick chat to understand your mortgage readiness and learn exactly what you'll need.",
    href: "/ai-coach",
    buttonLabel: "Start Chat",
  },
  {
    step: 2,
    icon: Home,
    iconColor: "text-amber-500",
    bgColor: "bg-amber-500",
    title: "Browse properties",
    description: "Explore homes in your price range with instant mortgage estimates for each listing.",
    href: "/properties",
    buttonLabel: "Browse Homes",
  },
  {
    step: 3,
    icon: FileText,
    iconColor: "text-emerald-500",
    bgColor: "bg-emerald-500",
    title: "Get pre-approved",
    description: "Apply in about 3 minutes. Your coach already prepared you, so this will feel easy.",
    href: "/apply",
    buttonLabel: "Start Application",
  },
  {
    step: 4,
    icon: Upload,
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500",
    title: "Upload your documents",
    description: "Share pay stubs, bank statements, and tax returns to complete your verification.",
    href: "/documents",
    buttonLabel: "Upload Docs",
  },
];

interface FirstVisitWelcomeProps {
  userName?: string;
  hasApplication?: boolean;
  hasDocuments?: boolean;
  hasCoachSession?: boolean;
  hasBrowsedProperties?: boolean;
}

export function FirstVisitWelcome({ userName, hasApplication = false, hasDocuments = false, hasCoachSession = false, hasBrowsedProperties = false }: FirstVisitWelcomeProps) {
  const completedSteps = [
    hasCoachSession,
    hasBrowsedProperties,
    hasApplication,
    hasDocuments,
  ];

  const firstIncompleteIndex = completedSteps.findIndex(s => !s);
  const completedCount = completedSteps.filter(Boolean).length;

  return (
    <div className="space-y-5" data-testid="first-visit-welcome">
      <div className="text-center py-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground" data-testid="text-welcome-heading">
          {userName ? `Welcome, ${userName}!` : "Welcome to Baranest"}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
          Your path to homeownership starts here. We'll walk you through each step — beginning with a free chat with your AI Coach.
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 pb-1">
        <Badge variant="secondary" className="text-xs" data-testid="badge-progress">
          {completedCount} of {ONBOARDING_STEPS.length} completed
        </Badge>
      </div>

      <div className="space-y-3">
        {ONBOARDING_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isComplete = completedSteps[index];
          const isActive = index === firstIncompleteIndex;

          return (
            <Card
              key={step.step}
              className={isActive ? "border-primary/30 shadow-md" : ""}
              data-testid={`card-onboarding-step-${step.step}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      isComplete
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isActive
                        ? `border-primary bg-primary/10 ${step.iconColor}`
                        : "border-border text-muted-foreground"
                    }`}>
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    {index < ONBOARDING_STEPS.length - 1 && (
                      <div className={`w-0.5 h-4 rounded-full ${
                        isComplete ? "bg-emerald-500" : "bg-border"
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-medium ${
                        isComplete ? "text-muted-foreground line-through" : "text-foreground"
                      }`} data-testid={`text-step-title-${step.step}`}>
                        {step.title}
                      </p>
                      {isComplete && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                          Done
                        </Badge>
                      )}
                      {isActive && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          Next
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {step.description}
                    </p>
                    {step.step === 2 && isActive && (
                      <Link href="/apply" className="inline-flex items-center gap-1 mt-1" data-testid="link-have-property">
                        <p className="text-xs text-primary hover:underline cursor-pointer" data-testid="text-have-property">
                          Already found a home? Skip to application
                        </p>
                        <ArrowRight className="h-3 w-3 text-primary" />
                      </Link>
                    )}
                  </div>
                  {(isActive || isComplete) && (
                    <Link href={step.href} className="shrink-0" data-testid={`link-step-${step.step}`}>
                      <Button
                        variant={isActive ? "default" : "ghost"}
                        size="sm"
                        data-testid={`button-step-${step.step}`}
                      >
                        {isActive ? step.buttonLabel : "View"}
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="hover-elevate" data-testid="card-quick-tools">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Quick Tools
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/calculators/affordability" data-testid="link-quick-calculator">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-quick-calculator">
                <Calculator className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                Affordability
              </Button>
            </Link>
            <Link href="/rates" data-testid="link-quick-rates">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-quick-rates">
                <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                Today's Rates
              </Button>
            </Link>
            <Link href="/first-time-buyer" data-testid="link-quick-ftb">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-quick-ftb">
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                Buyer Guide
              </Button>
            </Link>
            <Link href="/down-payment-wizard" data-testid="link-quick-dpa">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" data-testid="button-quick-dpa">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                Down Payment
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
