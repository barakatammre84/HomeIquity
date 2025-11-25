import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { 
  Home,
  RefreshCw,
  Banknote,
  ArrowRight,
  BarChart3,
  Sparkles,
  LayoutDashboard,
  Phone
} from "lucide-react";

const loanOptions = [
  {
    icon: Home,
    title: "Buy a home",
    description: "Get pre-approved for a home purchase",
    href: "/apply",
  },
  {
    icon: RefreshCw,
    title: "Refinance my mortgage",
    description: "Lower your rate or change your term",
    href: "/apply",
  },
  {
    icon: Banknote,
    title: "Get cash from my home",
    description: "Access your home equity",
    href: "/apply",
  },
];

const stats = [
  { value: "$50B", label: "home loans funded entirely online" },
  { value: "200K", label: "customers who chose MortgageAI" },
];

const benefits = [
  {
    icon: BarChart3,
    text: "Custom mortgage rates",
  },
  {
    icon: Sparkles,
    text: "Exclusive offers",
  },
  {
    icon: LayoutDashboard,
    text: "A personalized dashboard",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <section className="py-12 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <Home className="h-8 w-8 text-primary-foreground" />
            </div>
            
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
              Hi, I'm Mia!
            </h1>
            <p className="mt-2 text-xl text-muted-foreground sm:text-2xl">
              What can I help you with?
            </p>
            
            <div className="mt-10 w-full space-y-4">
              {loanOptions.map((option) => (
                <Link key={option.title} href={option.href}>
                  <Card 
                    className="w-full cursor-pointer border-2 transition-all hover:border-primary hover-elevate"
                    data-testid={`card-option-${option.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <option.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-foreground">{option.title}</h3>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
            
            <div className="mt-8 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Already have an application?</span>
              <Link href="/dashboard">
                <Button variant="ghost" className="h-auto p-0 text-primary hover:text-primary hover:bg-transparent">
                  Click here <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-background py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center gap-8 sm:flex-row sm:gap-16">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-4xl font-bold text-foreground sm:text-5xl">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <Card className="bg-muted/30">
            <CardContent className="p-6 sm:p-8">
              <p className="text-center font-medium text-foreground">
                After a few questions, you'll unlock:
              </p>
              
              <div className="mt-6 space-y-4">
                {benefits.map((benefit) => (
                  <div key={benefit.text} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <benefit.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm text-foreground">{benefit.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-t py-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              Need help? We're here for you.
            </h2>
            <p className="mt-2 text-muted-foreground">
              Our mortgage experts are available to answer your questions.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">1-800-MORTGAGE</span>
            </div>
            <Link href="/apply" className="mt-6">
              <Button size="lg" className="gap-2" data-testid="button-get-started">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
