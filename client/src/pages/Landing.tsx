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

      {/* Hero Section - Baranest Soft Canvas */}
      <section className="relative bg-accent px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              A simpler way to
            </h1>
            <h2 className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              <span className="text-primary">get home-ready</span>
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Clear, calm, and achievable. Get pre-approved in minutes
              <br className="hidden sm:block" />
              with a mortgage experience designed around you.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3">
              <Link href="/apply">
                <Button
                  size="lg"
                  className="gap-2 px-8 py-6 text-base"
                  data-testid="button-hero-preapprove"
                >
                  Get Pre-Approved
                </Button>
              </Link>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                3 min | No hard credit check
              </span>
            </div>
          </div>

          {/* Phone Mockup with Feature Cards */}
          <div className="relative mt-12 flex justify-center">
            <div className="relative">
              {/* Phone Frame */}
              <div className="relative mx-auto w-64 rounded-3xl border-4 border-gray-800 bg-gray-800 p-2 shadow-2xl sm:w-72">
                <div className="overflow-hidden rounded-2xl bg-white">
                  {/* Phone Screen Content */}
                  <div className="bg-primary p-4 text-white">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                        <span className="text-sm font-bold">680</span>
                      </div>
                      <span className="text-sm">You're on track</span>
                    </div>
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="rounded-lg bg-accent p-3">
                      <p className="text-xs text-muted-foreground">You don't need perfect credit to qualify</p>
                    </div>
                    <div className="rounded-lg bg-secondary p-3">
                      <p className="text-xs text-muted-foreground">Just one more step</p>
                    </div>
                    <div className="border-t pt-3">
                      <p className="text-xs font-medium text-primary">Congrats, you're pre-approved!</p>
                      <p className="text-xs text-muted-foreground">for a loan up to</p>
                      <p className="text-2xl font-bold text-foreground">$450,000</p>
                    </div>
                    <div className="rounded-lg bg-secondary p-3">
                      <p className="text-xs text-muted-foreground">See your customized rate options</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Feature Cards */}
              <Card className="absolute -right-4 top-8 hidden w-48 border-0 shadow-lg sm:block lg:-right-24">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-xs font-medium">You don't need</p>
                      <p className="text-xs text-muted-foreground">perfect credit to qualify</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="absolute -left-4 top-32 hidden w-48 border-0 shadow-lg sm:block lg:-left-24">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-xs font-medium">We'll let you know</p>
                      <p className="text-xs text-muted-foreground">if anything changes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Video Testimonial */}
            <div className="flex flex-col items-center">
              <div className="relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-2xl bg-gray-900 shadow-xl">
                <div className="flex h-full flex-col justify-end bg-gradient-to-t from-black/80 to-transparent p-6">
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                      <div className="h-0 w-0 border-l-[20px] border-t-[12px] border-b-[12px] border-l-white border-t-transparent border-b-transparent ml-1"></div>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-white">
                    "I used Baranest for my primary residence and just closed on my vacation home. Very simple process. The team was calm and reassuring every step of the way."
                  </p>
                  <p className="mt-3 text-xs text-gray-400">Paul, Mortgage Customer</p>
                </div>
              </div>

              {/* Testimonial Tabs */}
              <div className="mt-6 flex gap-3">
                {testimonials.map((person) => (
                  <Button
                    key={person.name}
                    variant={person.active ? "default" : "outline"}
                    size="sm"
                    className={person.active ? "" : ""}
                  >
                    {person.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Text Content */}
            <div className="text-center lg:text-left">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Find out why
                <br />
                we're better.
              </h2>

              <Button
                className="mt-8 gap-2"
                data-testid="button-see-stories"
              >
                See all our stories
              </Button>

              <div className="mt-6 flex items-center justify-center gap-2 lg:justify-start">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <span className="text-sm font-medium">Excellent</span>
                <span className="text-sm text-gray-500">4.8 out of 5</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links Section */}
      <section className="border-t bg-gray-50 px-4 py-16 dark:bg-gray-900/50 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold tracking-tight">Get started today</h2>
          <p className="mt-2 text-muted-foreground">
            Join thousands who've simplified their mortgage journey
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <Link href="/apply">
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <h3 className="font-semibold">Buy a home</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Get pre-approved for a home purchase in minutes
                  </p>
                  <Button
                    variant="ghost"
                    className="mt-4 gap-1 p-0 text-primary hover:text-primary/80 hover:bg-transparent"
                    data-testid="button-buy-home"
                  >
                    Get started <ArrowRight className="h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/apply">
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <h3 className="font-semibold">Refinance</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Lower your rate or change your loan terms
                  </p>
                  <Button
                    variant="ghost"
                    className="mt-4 gap-1 p-0 text-primary hover:text-primary/80 hover:bg-transparent"
                    data-testid="button-refinance"
                  >
                    Get started <ArrowRight className="h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/properties">
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <h3 className="font-semibold">Browse properties</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Find your dream home with instant pre-approval
                  </p>
                  <Button
                    variant="ghost"
                    className="mt-4 gap-1 p-0 text-primary hover:text-primary/80 hover:bg-transparent"
                    data-testid="button-browse-properties"
                  >
                    Browse <ArrowRight className="h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
