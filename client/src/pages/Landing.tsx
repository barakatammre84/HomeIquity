import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { 
  CheckCircle2,
  Sparkles,
  Clock,
  Star,
  ArrowRight
} from "lucide-react";

const testimonials = [
  { name: "Paul", active: true },
  { name: "Amanda", active: false },
  { name: "Tiara", active: false },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
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
              <Card className="border-0 bg-white shadow-lg dark:bg-card">
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-primary">3 min</p>
                  <p className="mt-2 text-sm text-muted-foreground">Average application time</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white shadow-lg dark:bg-card">
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-emerald-500">97%</p>
                  <p className="mt-2 text-sm text-muted-foreground">Customer satisfaction</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white shadow-lg dark:bg-card">
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-primary">$450K</p>
                  <p className="mt-2 text-sm text-muted-foreground">Average approval amount</p>
                </CardContent>
              </Card>
              <Card className="border-0 bg-white shadow-lg dark:bg-card">
                <CardContent className="p-6 text-center">
                  <p className="text-4xl font-bold text-emerald-500">24/7</p>
                  <p className="mt-2 text-sm text-muted-foreground">Support available</p>
                </CardContent>
              </Card>
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
                className="w-full gap-2 bg-emerald-500 px-10 py-6 text-base font-semibold shadow-lg shadow-emerald-500/25 sm:w-auto"
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
                className="w-full gap-2 px-10 py-6 text-base sm:w-auto"
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
