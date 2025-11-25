import { Link } from "wouter";
import { Home, Shield, Clock, Award } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-6 w-6 text-primary" />
              <span className="text-xl font-semibold">MortgageAI</span>
            </Link>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              Revolutionizing home lending with AI-powered automated underwriting. 
              Get pre-approved in minutes, not weeks.
            </p>
            <div className="mt-6 flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Bank-level security</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>24/7 service</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Products</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li><Link href="/apply" className="hover:text-foreground transition-colors">Purchase Loan</Link></li>
              <li><Link href="/apply" className="hover:text-foreground transition-colors">Refinance</Link></li>
              <li><Link href="/apply" className="hover:text-foreground transition-colors">FHA Loans</Link></li>
              <li><Link href="/apply" className="hover:text-foreground transition-colors">VA Loans</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Company</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li><span className="hover:text-foreground transition-colors cursor-pointer">About Us</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-pointer">For Brokers</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-pointer">Privacy Policy</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-pointer">Terms of Service</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} MortgageAI. All rights reserved. NMLS #123456
          </p>
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Equal Housing Lender
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
