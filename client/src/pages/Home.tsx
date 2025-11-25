import { Link } from "wouter";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, PlayCircle, TrendingUp } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-green-800 to-green-900 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            The first
          </h1>
          <h2 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="text-green-300">AI-powered</span>{" "}
            <span className="text-white">Mortgage</span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-green-100">
            Our tech unlocks lower rates, higher chances of approval,{" "}
            <br />
            and a lightning-fast process from approval to closing. Over $100 billion funded.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="/apply">
              <Button
                size="lg"
                className="gap-2 bg-green-500 hover:bg-green-600"
                data-testid="button-hero-preapprove"
              >
                Get pre-approved
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <span className="text-sm text-green-200">Takes ~3 min to get started</span>
          </div>

          {/* Feature Cards */}
          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            <Card className="border-green-700 bg-green-700/20 backdrop-blur">
              <CardContent className="p-4 text-left">
                <div className="flex items-center gap-2 text-green-300 mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-white">Congratulate yourself</p>
                <p className="mt-1 text-xs text-green-100">Pre-approved for up to</p>
                <p className="text-2xl font-bold text-green-300">$450,000</p>
              </CardContent>
            </Card>

            <Card className="border-green-700 bg-green-700/20 backdrop-blur">
              <CardContent className="p-4 text-left">
                <div className="flex items-center gap-2 text-green-300 mb-2">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-white">Next step is simple</p>
                <p className="mt-1 text-xs text-green-100">3-min pre-approval decision</p>
              </CardContent>
            </Card>

            <Card className="border-green-700 bg-green-700/20 backdrop-blur">
              <CardContent className="p-4 text-left">
                <div className="flex items-center gap-2 text-green-300 mb-2">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-white">Get pre-approved</p>
                <p className="mt-1 text-xs text-green-100">No income verification needed</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Why Better Section */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 lg:items-center">
            {/* Video/Image */}
            <div className="flex justify-center">
              <div className="relative aspect-video w-full max-w-sm overflow-hidden rounded-2xl bg-gray-200">
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-green-100 to-green-50">
                  <div className="flex flex-col items-center gap-4">
                    <PlayCircle className="h-16 w-16 text-green-600" />
                    <p className="text-center text-sm font-medium text-gray-700">
                      Watch our founder explain why we're better
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Text Content */}
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Find out why we're better.
              </h2>

              <p className="mt-4 text-lg text-muted-foreground">
                Our AI-powered underwriting process eliminates the need for traditional processors and underwriters, 
                getting you pre-approved faster with transparent pricing and no hidden fees.
              </p>

              <Button
                variant="default"
                className="mt-8 gap-2 bg-green-700 hover:bg-green-800"
                data-testid="button-see-stories"
              >
                See all our stories
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="mt-6 flex flex-col gap-2">
                <Badge variant="outline" className="w-fit">
                  4.9/5 customer rating
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Powered by Google AI • Transparent pricing • 24/7 support
                </p>
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
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="p-6">
                  <h3 className="font-semibold">Buy a home</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Get pre-approved for a home purchase in minutes
                  </p>
                  <Button
                    variant="ghost"
                    className="mt-4 gap-1 p-0 text-green-700 hover:text-green-800 hover:bg-transparent"
                    data-testid="button-buy-home"
                  >
                    Get started <ArrowRight className="h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/apply">
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="p-6">
                  <h3 className="font-semibold">Refinance</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Lower your rate or change your loan terms
                  </p>
                  <Button
                    variant="ghost"
                    className="mt-4 gap-1 p-0 text-green-700 hover:text-green-800 hover:bg-transparent"
                    data-testid="button-refinance"
                  >
                    Get started <ArrowRight className="h-3 w-3" />
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/properties">
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="p-6">
                  <h3 className="font-semibold">Browse properties</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Find your dream home with instant pre-approval
                  </p>
                  <Button
                    variant="ghost"
                    className="mt-4 gap-1 p-0 text-green-700 hover:text-green-800 hover:bg-transparent"
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
