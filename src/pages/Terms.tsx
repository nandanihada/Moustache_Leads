import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Button 
          variant="ghost" 
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Terms of Service</CardTitle>
            <p className="text-muted-foreground">Last updated: January 2026</p>
          </CardHeader>
          <CardContent className="prose prose-gray max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-gray-600">
                By accessing and using MoustacheLeads ("the Platform"), you agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Description of Service</h2>
              <p className="text-gray-600">
                MoustacheLeads is an affiliate marketing platform that connects publishers with advertisers. 
                We provide tools for tracking, reporting, and managing affiliate campaigns.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. User Accounts</h2>
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                <li>You must provide accurate and complete information when creating an account</li>
                <li>You are responsible for maintaining the security of your account credentials</li>
                <li>You must be at least 18 years old to use this platform</li>
                <li>One person or entity may only maintain one account</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Prohibited Activities</h2>
              <p className="text-gray-600 mb-2">Users are prohibited from:</p>
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                <li>Engaging in fraudulent activities or generating fake traffic</li>
                <li>Using bots, scripts, or automated tools to manipulate conversions</li>
                <li>Violating any applicable laws or regulations</li>
                <li>Misrepresenting your identity or affiliation</li>
                <li>Interfering with the platform's operation or security</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Payments</h2>
              <ul className="list-disc pl-6 text-gray-600 space-y-2">
                <li>Payments are processed according to the payment schedule specified in your account</li>
                <li>Minimum payout thresholds may apply</li>
                <li>We reserve the right to withhold payments for suspected fraudulent activity</li>
                <li>All earnings are subject to verification before payment</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Intellectual Property</h2>
              <p className="text-gray-600">
                All content, trademarks, and intellectual property on this platform are owned by MoustacheLeads 
                or its licensors. You may not use, copy, or distribute any content without prior written permission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Limitation of Liability</h2>
              <p className="text-gray-600">
                MoustacheLeads shall not be liable for any indirect, incidental, special, consequential, or punitive damages 
                resulting from your use of or inability to use the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Termination</h2>
              <p className="text-gray-600">
                We reserve the right to suspend or terminate your account at any time for violation of these terms 
                or for any other reason at our sole discretion.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Changes to Terms</h2>
              <p className="text-gray-600">
                We may modify these terms at any time. Continued use of the platform after changes constitutes 
                acceptance of the modified terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Contact</h2>
              <p className="text-gray-600">
                For questions about these Terms of Service, please contact us at{" "}
                <a href="mailto:support@moustacheleads.com" className="text-primary hover:underline">
                  support@moustacheleads.com
                </a>
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Terms;
