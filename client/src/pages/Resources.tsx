import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  LayoutDashboard,
  FileText,
  CheckCircle2,
  CreditCard,
  BookOpen,
  FileCheck,
  ChevronRight,
  ExternalLink,
  Calculator,
  Home,
  Users,
  TrendingUp,
} from "lucide-react";

const sidebarItems = [
  {
    label: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Application Summary",
    href: "/dashboard",
    icon: FileText,
  },
  {
    label: "Tasks",
    href: "/dashboard",
    icon: CheckCircle2,
  },
  {
    label: "My loans",
    href: "/dashboard",
    icon: CreditCard,
  },
  {
    label: "Resources",
    href: "/resources",
    icon: BookOpen,
    active: true,
  },
  {
    label: "Documents",
    href: "/documents",
    icon: FileCheck,
  },
];

const resources = [
  {
    category: "Guides",
    items: [
      {
        title: "Calculating affordability",
        description: "Understand how much house you can afford based on your income and debt",
        icon: Calculator,
        action: "Get started",
      },
      {
        title: "Finding an agent",
        description: "Learn how to find the right real estate agent for your home search",
        icon: Users,
        action: "Get started",
      },
      {
        title: "Making an offer",
        description: "Step-by-step guide to making a competitive offer on your dream home",
        icon: Home,
        action: "Get started",
      },
      {
        title: "Understanding the process",
        description: "Complete overview of the mortgage and home buying process",
        icon: TrendingUp,
        action: "Get started",
      },
    ],
  },
  {
    category: "Tools & Resources",
    items: [
      {
        title: "Pre-approval letter",
        description: "Start your search with a pre-approval letter from MortgageAI",
        icon: undefined,
        action: "Read more",
      },
      {
        title: "Mortgage affordability calculator",
        description: "Figure out how much you can spend on your home",
        icon: Calculator,
        action: "Get started",
      },
      {
        title: "Find an agent",
        description: "Find the right real estate agent for your needs",
        icon: Users,
        action: "Get started",
      },
      {
        title: "Check today's rates",
        description: "See our latest mortgage rates and compare options",
        icon: TrendingUp,
        action: "See rates",
      },
    ],
  },
];

export default function Resources() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="w-full border-b bg-background p-4 sm:p-6 lg:w-60 lg:border-b-0 lg:border-r lg:p-6">
          <div className="mb-6 hidden lg:block">
            <h2 className="text-lg font-semibold">Menu</h2>
          </div>
          <nav className="space-y-1">
            {sidebarItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={item.active ? "default" : "ghost"}
                  className="w-full justify-start gap-3"
                  data-testid={`button-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Button>
              </Link>
            ))}
          </nav>
        </aside>

        <main className="flex-1">
          <div className="border-b p-4 sm:p-6 lg:p-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Resources</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything you'll need along the way
            </p>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Our articles, tools, and videos are here to guide you through the home-buying process — 
              from understanding the financing to what you can afford.
            </p>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {resources.map((section) => (
              <div key={section.category} className="mb-12">
                <h2 className="mb-6 text-xl font-semibold">{section.category}</h2>
                <div className="grid gap-6 md:grid-cols-2">
                  {section.items.map((item) => (
                    <Card
                      key={item.title}
                      className="hover-elevate flex flex-col"
                      data-testid={`card-resource-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <CardContent className="flex flex-1 flex-col p-6">
                        {item.icon && (
                          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                            <item.icon className="h-5 w-5 text-primary" />
                          </div>
                        )}
                        <h3 className="font-semibold text-foreground">{item.title}</h3>
                        <p className="mt-2 flex-1 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                        <Button
                          variant="ghost"
                          className="mt-4 w-fit gap-1 p-0 text-primary hover:text-primary hover:bg-transparent"
                          data-testid={`button-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          {item.action}
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
