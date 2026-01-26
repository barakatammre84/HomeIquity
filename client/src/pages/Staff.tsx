import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Phone,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

const teamMembers = [
  {
    role: "Loan Consultant",
    title: "Your dedicated loan expert",
    description: "Your Loan Consultant will be assigned and is available to guide you and answer any questions about your application.",
    status: "Assigning",
    benefits: [
      "Unlock personalized savings and exclusive rate options",
      "Get expert guidance to fast-track your approval",
      "Find a financing solution tailored to your goals",
    ],
    phone: "1-800-MORTGAGE",
    showPhone: true,
  },
  {
    role: "Coordinator",
    title: "Your mortgage journey guide",
    description: "Once you work with a Loan Consultant, you'll have a Coordinator who will help with documentation and answer questions during underwriting.",
  },
  {
    role: "Real Estate Agent",
    title: "Find your dream home",
    description: "Baranest has a network of trusted real estate agents who can help you with your home search. Start getting matched with agents in your area.",
  },
];

export default function Staff() {
  return (
    <>
          <div className="border-b p-4 sm:p-6 lg:p-8">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span className="text-sm text-muted-foreground">Your team</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              Here every step of the way
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              From choosing a rate to scheduling closing, you have a dedicated team of specialists. Along the way, we'll work with you to make it happen when and where you want it.
            </p>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            <div className="space-y-6">
              {teamMembers.map((member, index) => (
                <Card key={member.role} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{member.role}</h3>
                          {index === 0 && (
                            <Badge variant="outline" className="text-xs">
                              {member.status}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{member.title}</p>
                        <p className="mt-3 text-sm">{member.description}</p>

                        {member.benefits && (
                          <ul className="mt-4 space-y-2">
                            {member.benefits.map((benefit) => (
                              <li key={benefit} className="flex items-start gap-2 text-sm">
                                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
                                <span>{benefit}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {member.showPhone ? (
                        <div className="flex flex-col gap-3 md:w-64">
                          <div className="flex flex-col items-start gap-1 rounded-lg bg-muted/50 p-4">
                            <span className="text-xs text-muted-foreground">Your Loan Consultant will be assigned</span>
                            <span className="text-xs text-muted-foreground">Check back within 24 hours</span>
                          </div>
                          <Button
                            size="lg"
                            className="w-full gap-2 bg-green-600 hover:bg-green-700"
                            data-testid="button-call-consultant"
                          >
                            <Phone className="h-4 w-4" />
                            {member.phone}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="md:w-fit"
                          data-testid={`button-${member.role.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          Get {member.role.toLowerCase()}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="mt-8">
              <CardContent className="p-6">
                <h3 className="font-semibold">Hours of Operation</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  If your current support request is not immediately available, you can leave a message for them to get back to you as soon as possible.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Phone Available</p>
                    <p className="text-sm text-muted-foreground">7 days a week</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Hours</p>
                    <p className="text-sm text-muted-foreground">8am - 8pm CST</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
    </>
  );
}
