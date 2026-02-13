import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useQuery } from "@tanstack/react-query";
import { usePageView } from "@/hooks/useActivityTracker";
import { 
  CheckCircle2,
  Sparkles,
  Clock,
  Star,
  ArrowRight,
  Shield,
  Home,
  FileText,
  TrendingUp,
  Calculator,
  Search,
  Percent,
  Scale,
} from "lucide-react";

export default function Landing() {
  usePageView("/");
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Baranest - Clear Answers. Confident Approvals."
        description="Get pre-approved for a mortgage in 3 minutes. Baranest delivers clear mortgage decisions and trustworthy pre-approvals with no guesswork and no surprises."
        ogType="website"
      />
      <Navigation />

      {/* Hero Section - Premium Gradient */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-[hsl(213,52%,18%)] px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        {/* Decorative gradient orbs */}
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />
        
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              Trusted by 50,000+ homebuyers
            </div>
            
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Clear answers.
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Confident approvals.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-white/80 sm:text-xl">
              Get pre-approved in 3 minutes with a process built for certainty.
              <br className="hidden sm:block" />
              No guesswork. No surprises.
            </p>

            <div className="mt-10 flex w-full max-w-md flex-col items-center gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:gap-4">
              <Link href="/apply" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full gap-2 bg-emerald-500 font-semibold text-white shadow-lg shadow-emerald-500/25 sm:w-auto"
                  data-testid="button-hero-preapprove"
                >
                  Get Pre-Approved
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/properties" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full gap-2 border-white/30 bg-white/10 text-white backdrop-blur-sm sm:w-auto"
                  data-testid="button-hero-browse"
                >
                  Browse Properties
                </Button>
              </Link>
            </div>
            
            <div className="mt-6 flex items-center gap-6 text-sm text-white/70">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                3 min application
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                No hard credit check
              </span>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="relative mt-16 grid gap-4 sm:grid-cols-3 sm:gap-6">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm">
              <p className="text-3xl font-bold text-white">$12B+</p>
              <p className="mt-1 text-sm text-white/70">Loans funded</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm">
              <p className="text-3xl font-bold text-white">50K+</p>
              <p className="mt-1 text-sm text-white/70">Happy homeowners</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm">
              <p className="text-3xl font-bold text-emerald-400">4.9</p>
              <p className="mt-1 text-sm text-white/70">Customer rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Get pre-approved in three simple steps
            </p>
          </div>
          
          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            <div className="relative text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white shadow-lg shadow-primary/25">
                1
              </div>
              <h3 className="mt-6 text-xl font-semibold">Answer a few questions</h3>
              <p className="mt-3 text-muted-foreground">
                Tell us about your income, assets, and the home you're looking for.
              </p>
            </div>
            
            <div className="relative text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white shadow-lg shadow-primary/25">
                2
              </div>
              <h3 className="mt-6 text-xl font-semibold">Get instant approval</h3>
              <p className="mt-3 text-muted-foreground">
                Our system analyzes your profile and delivers a decision in minutes.
              </p>
            </div>
            
            <div className="relative text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-2xl font-bold text-white shadow-lg shadow-emerald-500/25">
                3
              </div>
              <h3 className="mt-6 text-xl font-semibold">Start shopping</h3>
              <p className="mt-3 text-muted-foreground">
                Use your pre-approval letter to make offers with confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Features Section */}
      <section className="border-y bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need, in one place
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              From pre-approval to closing, Baranest has you covered
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card data-testid="card-feature-preapproval">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold" data-testid="text-feature-title-preapproval">Instant Pre-Approval</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Get a real pre-approval letter in minutes. No credit score impact, no hidden fees, no games.
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-feature-properties">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Search className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold" data-testid="text-feature-title-properties">Live Property Search</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Browse homes across the US with live MLS data and see instant mortgage estimates for every listing.
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-feature-rates">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Percent className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold" data-testid="text-feature-title-rates">Competitive Rates</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Compare mortgage rates from top lenders updated daily. Conventional, FHA, VA, and more.
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-feature-calculators">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Calculator className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold" data-testid="text-feature-title-calculators">Smart Calculators</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Affordability, rent vs buy, and mortgage calculators to help you make informed decisions.
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-feature-dashboard">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold" data-testid="text-feature-title-dashboard">Track Your Progress</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  A personal dashboard to monitor your application, upload documents, and track milestones.
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-feature-education">
              <CardContent className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <Home className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold" data-testid="text-feature-title-education">Buyer Education</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  First-time buyer guides, down payment assistance tools, and educational resources.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Live Rates Teaser */}
      <RatesTeaser />

      {/* Social Proof Section */}
      <section className="border-y bg-muted/30 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 md:grid-cols-2 lg:items-center">
            {/* Quote */}
            <div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <blockquote className="mt-6 text-2xl font-medium leading-relaxed tracking-tight">
                "The fastest, clearest mortgage process I've ever experienced. I knew exactly where I stood every step of the way."
              </blockquote>
              <div className="mt-6">
                <p className="font-semibold">Sarah M.</p>
                <p className="text-sm text-muted-foreground">First-time homebuyer, Austin TX</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid gap-6 sm:grid-cols-2">
              <Card data-testid="card-stat-time">
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-primary" data-testid="text-stat-time">3 min</p>
                  <p className="mt-2 text-sm text-muted-foreground">Average application time</p>
                </CardContent>
              </Card>
              <Card data-testid="card-stat-satisfaction">
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-emerald-500" data-testid="text-stat-satisfaction">97%</p>
                  <p className="mt-2 text-sm text-muted-foreground">Customer satisfaction</p>
                </CardContent>
              </Card>
              <Card data-testid="card-stat-approval">
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-primary" data-testid="text-stat-approval">$450K</p>
                  <p className="mt-2 text-sm text-muted-foreground">Average approval amount</p>
                </CardContent>
              </Card>
              <Card data-testid="card-stat-support">
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-emerald-500" data-testid="text-stat-support">24/7</p>
                  <p className="mt-2 text-sm text-muted-foreground">Support available</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Compliance Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border bg-card p-8 sm:p-12">
            <div className="flex flex-col items-center gap-8 text-center lg:flex-row lg:text-left">
              <div className="flex-1">
                <div className="flex items-center justify-center gap-2 lg:justify-start">
                  <Shield className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-xl font-semibold">Your trust is our foundation</h3>
                </div>
                <p className="mt-3 text-muted-foreground leading-relaxed">
                  Baranest is a licensed mortgage lender (NMLS #123456) committed to fair lending practices, 
                  regulatory compliance, and the highest standards of data security.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-6">
                <div className="flex flex-col items-center gap-1.5 rounded-xl border bg-background p-4" data-testid="badge-trust-ehl">
                  <Scale className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium text-center">Equal Housing Lender</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 rounded-xl border bg-background p-4" data-testid="badge-trust-nmls">
                  <Shield className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium text-center">NMLS Licensed</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 rounded-xl border bg-background p-4" data-testid="badge-trust-encryption">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-xs font-medium text-center">256-bit Encrypted</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 rounded-xl border bg-background p-4" data-testid="badge-trust-mismo">
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="text-xs font-medium text-center">MISMO 3.4</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Ready to get started?
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Join over 50,000 homebuyers who trust Baranest for clear, confident mortgage decisions.
          </p>
          
          <div className="mt-10 flex w-full max-w-md mx-auto flex-col items-center gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:justify-center sm:gap-4">
            <Link href="/apply" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full gap-2 bg-emerald-500 font-semibold shadow-lg shadow-emerald-500/25 sm:w-auto"
                data-testid="button-cta-preapprove"
              >
                Get Pre-Approved Now
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/properties" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full gap-2 sm:w-auto"
                data-testid="button-cta-browse"
              >
                Browse Properties
              </Button>
            </Link>
          </div>
          
          <p className="mt-6 text-sm text-muted-foreground">
            No commitment required. No hard credit check.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}

interface RatePreview {
  id: number;
  programName: string;
  interestRate: string;
  apr: string;
  loanType: string;
}

function RatesTeaser() {
  const { data: rates, isLoading } = useQuery<RatePreview[]>({
    queryKey: ["/api/rates"],
  });

  const topRates = (rates || []).slice(0, 3);
  const hasRates = topRates.length > 0;

  if (!isLoading && !hasRates) return null;

  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8" data-testid="section-rates-teaser">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Today's mortgage rates
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Competitive rates updated daily
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {isLoading
            ? [1, 2, 3].map((i) => (
                <Card key={i} className="text-center">
                  <CardContent className="flex flex-col items-center p-6">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-3 h-10 w-24" />
                    <Skeleton className="mt-2 h-4 w-20" />
                    <Skeleton className="mt-3 h-3 w-16" />
                  </CardContent>
                </Card>
              ))
            : topRates.map((rate) => (
                <Card key={rate.id} className="text-center" data-testid={`card-rate-teaser-${rate.id}`}>
                  <CardContent className="p-6">
                    <p className="text-sm font-medium text-muted-foreground" data-testid={`text-rate-name-${rate.id}`}>{rate.programName}</p>
                    <p className="mt-2 text-4xl font-bold text-primary" data-testid={`text-rate-value-${rate.id}`}>{rate.interestRate}%</p>
                    <p className="mt-1 text-sm text-muted-foreground">{rate.apr}% APR</p>
                    <p className="mt-3 text-xs text-muted-foreground">{rate.loanType}</p>
                  </CardContent>
                </Card>
              ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/rates">
            <Button variant="outline" className="gap-2" data-testid="button-view-all-rates">
              View All Rates
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">
            Rates are for illustrative purposes. Your rate may vary based on credit, property, and loan terms.
          </p>
        </div>
      </div>
    </section>
  );
}
