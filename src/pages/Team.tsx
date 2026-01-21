import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, Linkedin, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Team = () => {
  const navigate = useNavigate();

  const teamMembers = [
    {
      name: "MoustacheLeads Team",
      role: "Platform Development",
      description: "Building the best affiliate marketing platform for publishers and advertisers.",
      email: "team@moustacheleads.com"
    }
  ];

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

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-3xl">Our Team</CardTitle>
            <p className="text-muted-foreground">Meet the people behind MoustacheLeads</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-4">About Us</h2>
              <p className="text-gray-600 mb-4">
                MoustacheLeads is a leading affiliate marketing platform that connects publishers with 
                premium advertisers. Our mission is to provide the best tools and opportunities for 
                affiliate marketers to succeed.
              </p>
              <p className="text-gray-600">
                We're dedicated to transparency, fair payouts, and providing excellent support to our 
                partners. Whether you're a seasoned affiliate marketer or just getting started, we're 
                here to help you grow.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">Our Values</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-semibold text-blue-800 mb-2">Transparency</h3>
                  <p className="text-sm text-blue-700">
                    Clear reporting, honest communication, and fair practices.
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-2">Innovation</h3>
                  <p className="text-sm text-green-700">
                    Constantly improving our platform with new features and tools.
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-semibold text-purple-800 mb-2">Support</h3>
                  <p className="text-sm text-purple-700">
                    Dedicated team ready to help you succeed.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">Contact Us</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-gray-500" />
                  <a href="mailto:support@moustacheleads.com" className="text-primary hover:underline">
                    support@moustacheleads.com
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-gray-500" />
                  <a href="https://moustacheleads.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    moustacheleads.com
                  </a>
                </div>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Team;
