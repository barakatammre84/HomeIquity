import { Link } from "wouter";
import { Phone, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-primary text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-white">baranest</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">
              Clear answers. Confident approvals. Pre-approvals you can trust.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Contact Us</h3>
            <ul className="mt-4 space-y-1 text-sm text-white/70">
              <li>
                <a href="mailto:hello@baranest.com" className="flex items-center gap-2 rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-email">
                  <Mail className="h-4 w-4 shrink-0" />
                  hello@baranest.com
                </a>
              </li>
              <li>
                <a href="tel:1-800-MORTGAGE" className="flex items-center gap-2 rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-phone">
                  <Phone className="h-4 w-4 shrink-0" />
                  1-800-MORTGAGE
                </a>
              </li>
              <li><Link href="/faq" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-faq">FAQ</Link></li>
              <li><Link href="/resources" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-resources">Resources</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Legal</h3>
            <ul className="mt-4 space-y-1 text-sm text-white/70">
              <li><span className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors cursor-pointer">NMLS Consumer Access</span></li>
              <li><Link href="/privacy" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-privacy">Privacy Policy</Link></li>
              <li><span className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors cursor-pointer">Terms of Use</span></li>
              <li><span className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors cursor-pointer">Disclosures & Licensing</span></li>
              <li><span className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors cursor-pointer">Affiliated Business</span></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-white">Products</h3>
            <ul className="mt-4 space-y-1 text-sm text-white/70">
              <li><Link href="/apply" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-buy">Buy a home</Link></li>
              <li><Link href="/apply?type=refinance" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-refinance">Refinance</Link></li>
              <li><Link href="/apply?type=heloc" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-heloc">HELOC</Link></li>
              <li><Link href="/rates" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-rates">Rates</Link></li>
              <li><Link href="/resources" className="block rounded-md px-2 py-2 -mx-2 hover:text-white transition-colors" data-testid="link-footer-resources-2">Resources</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/20 pt-8">
          <p className="text-xs text-white/60 leading-relaxed">
            &copy; {new Date().getFullYear()} Baranest Corporation is a direct lender. NMLS #123456. 
            World Trade Center, 200 State Street, New York, NY 10000. Loans made or arranged pursuant to a California Finance Lenders Law License. 
            Not available in all states. Equal Housing Lender.
          </p>
          <p className="mt-4 text-xs text-white/60 leading-relaxed">
            Home lending products offered by Baranest Corporation are direct loans. Baranest is a licensed lender (NMLS #123456). 
            Loans made or arranged pursuant to a California Finance Lenders Law License. Not available in all states. Equal Housing Lender. 
            NMLS Consumer Access.
          </p>
        </div>
      </div>
    </footer>
  );
}
