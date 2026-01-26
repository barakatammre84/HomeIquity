import { Link } from "wouter";
import { Home, Phone, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-semibold text-primary tracking-tight">baranest</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Clear answers. Confident approvals. Pre-approvals you can trust.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Contact Us</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>
                <a href="mailto:hello@baranest.com" className="flex items-center gap-2 hover:text-foreground transition-colors">
                  <Mail className="h-4 w-4" />
                  hello@baranest.com
                </a>
              </li>
              <li>
                <a href="tel:1-800-MORTGAGE" className="flex items-center gap-2 hover:text-foreground transition-colors">
                  <Phone className="h-4 w-4" />
                  1-800-MORTGAGE
                </a>
              </li>
              <li><span className="hover:text-foreground transition-colors cursor-pointer">FAQ</span></li>
              <li><Link href="/resources" className="hover:text-foreground transition-colors">Resources</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Legal</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li><span className="hover:text-foreground transition-colors cursor-pointer">NMLS Consumer Access</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-pointer">Privacy Policy</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-pointer">Terms of Use</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-pointer">Disclosures & Licensing</span></li>
              <li><span className="hover:text-foreground transition-colors cursor-pointer">Affiliated Business</span></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Products</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li><Link href="/apply" className="hover:text-foreground transition-colors">Buy a home</Link></li>
              <li><Link href="/apply" className="hover:text-foreground transition-colors">Refinance</Link></li>
              <li><Link href="/apply" className="hover:text-foreground transition-colors">HELOC</Link></li>
              <li><Link href="/apply" className="hover:text-foreground transition-colors">Rates</Link></li>
              <li><Link href="/resources" className="hover:text-foreground transition-colors">Better+</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t pt-8">
          <p className="text-xs text-muted-foreground leading-relaxed">
            © {new Date().getFullYear()} Baranest Corporation is a direct lender. NMLS #123456. 
            World Trade Center, 200 State Street, New York, NY 10000. Loans made or arranged pursuant to a California Finance Lenders Law License. 
            Not available in all states. Equal Housing Lender.
          </p>
          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">
            Home lending products offered by Baranest Corporation are direct loans. Baranest is a licensed lender (NMLS #123456). 
            Loans made or arranged pursuant to a California Finance Lenders Law License. Not available in all states. Equal Housing Lender. 
            NMLS Consumer Access.
          </p>
        </div>
      </div>
    </footer>
  );
}
