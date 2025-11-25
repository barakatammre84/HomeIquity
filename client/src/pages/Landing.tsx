import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { 
  Clock, 
  Shield, 
  TrendingDown, 
  FileCheck, 
  Users, 
  Building2,
  ArrowRight,
  CheckCircle2,
  Zap
} from "lucide-react";
import heroImage from "@assets/stock_images/modern_luxury_home_e_0b91d0f6.jpg";

const stats = [
  { value: "3 min", label: "Pre-approval time" },
  { value: "$0", label: "Origination fees" },
  { value: "21 days", label: "Average closing" },
  { value: "4.5/5", label: "Customer rating" },
];

const features = [
  {
    icon: Clock,
    title: "3-Minute Pre-Approval",
    description: "Get pre-approved instantly with our AI-powered analysis. No paperwork, no waiting.",
  },
  {
    icon: TrendingDown,
    title: "Best Rates Guaranteed",
    description: "Compare rates across conventional, FHA, and VA loans. We'll match any competitor's offer.",
  },
  {
    icon: Shield,
    title: "No Hidden Fees",
    description: "Zero origination fees on most loans. Complete transparency on all costs upfront.",
  },
  {
    icon: FileCheck,
    title: "Automated Underwriting",
    description: "Our AI eliminates the need for processors and underwriters. Faster decisions, fewer errors.",
  },
  {
    icon: Users,
    title: "Real Estate Partner Network",
    description: "Connect with trusted real estate brokers who can help you find your dream home.",
  },
  {
    icon: Building2,
    title: "MLS Integration",
    description: "Browse properties and see instant loan options for each listing.",
  },
];

const steps = [
  {
    step: "01",
    title: "Answer a few questions",
    description: "Tell us about your income, employment, and the home you're looking for.",
  },
  {
    step: "02",
    title: "Get pre-approved instantly",
    description: "Our AI analyzes your information and provides instant pre-approval with loan options.",
  },
  {
    step: "03",
    title: "Compare & choose",
    description: "Review multiple loan scenarios with detailed breakdowns of rates, payments, and costs.",
  },
  {
    step: "04",
    title: "Lock your rate",
    description: "Choose your preferred loan and lock in your rate. We handle the rest.",
  },
];

const loanTypes = [
  {
    type: "Conventional",
    rate: "6.750%",
    description: "Traditional financing with competitive rates",
    features: ["3-20% down payment", "No mortgage insurance with 20% down", "Flexible terms"],
  },
  {
    type: "FHA",
    rate: "6.500%",
    description: "Government-backed for first-time buyers",
    features: ["3.5% minimum down", "Lower credit requirements", "Gift funds allowed"],
  },
  {
    type: "VA",
    rate: "6.250%",
    description: "Exclusive benefits for veterans",
    features: ["0% down payment", "No PMI required", "Competitive rates"],
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <section className="relative min-h-[85vh] flex items-center">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Modern luxury home"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
        </div>
        
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/20 px-4 py-1.5 backdrop-blur-sm">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-white">AI-Powered Lending</span>
            </div>
            
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Get pre-approved in{" "}
              <span className="text-primary">3 minutes</span>
            </h1>
            
            <p className="mt-6 text-lg text-gray-300 sm:text-xl">
              Skip the paperwork and waiting. Our AI-powered platform analyzes your 
              application instantly and provides multiple loan options with transparent pricing.
            </p>
            
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link href="/apply">
                <Button size="lg" className="w-full gap-2 text-base sm:w-auto" data-testid="button-hero-apply">
                  Get Pre-Approved Now
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/properties">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="w-full text-base sm:w-auto bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                  data-testid="button-hero-browse"
                >
                  Browse Properties
                </Button>
              </Link>
            </div>
            
            <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-2xl font-bold text-white sm:text-3xl">{stat.value}</p>
                  <p className="text-sm text-gray-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Why choose MortgageAI?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              We're reimagining the mortgage experience with technology that works for you.
            </p>
          </div>
          
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="hover-elevate">
                <CardContent className="p-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Four simple steps to your new home
            </p>
          </div>
          
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((item, index) => (
              <div key={item.step} className="relative">
                {index < steps.length - 1 && (
                  <div className="absolute left-1/2 top-8 hidden h-0.5 w-full bg-border lg:block" />
                )}
                <div className="relative flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                    {item.step}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Loan options for every situation
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Compare rates and find the perfect loan for your needs
            </p>
          </div>
          
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {loanTypes.map((loan) => (
              <Card key={loan.type} className="relative overflow-hidden hover-elevate">
                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold">{loan.type}</h3>
                    <p className="text-sm text-muted-foreground">{loan.description}</p>
                  </div>
                  
                  <div className="mb-6">
                    <p className="text-sm text-muted-foreground">Starting at</p>
                    <p className="text-4xl font-bold text-primary">{loan.rate}</p>
                    <p className="text-xs text-muted-foreground">APR</p>
                  </div>
                  
                  <ul className="space-y-3">
                    {loan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <Link href="/apply" className="mt-6 block">
                    <Button className="w-full" variant="outline">
                      Check my rate
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-primary py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">
            <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
              Ready to get started?
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-primary-foreground/80">
              Join thousands of homeowners who've simplified their mortgage journey with MortgageAI.
            </p>
            <Link href="/apply" className="mt-8">
              <Button 
                size="lg" 
                className="gap-2 bg-white text-primary hover:bg-white/90"
                data-testid="button-cta-apply"
              >
                Get Pre-Approved Now
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
