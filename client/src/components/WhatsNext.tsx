import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
} from "lucide-react";
import type { LoanApplication, Task } from "@shared/schema";

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

function getNextActions(props: WhatsNextProps): NextAction[] {
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
      href: "/learning-center",
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
      href: "/learning-center",
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
