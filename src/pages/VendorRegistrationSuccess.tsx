import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

const VendorRegistrationSuccess = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-0 shadow-2xl">
        <CardContent className="pt-12 pb-10 px-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <div className="relative bg-primary/10 rounded-full p-6">
                <CheckCircle2 className="h-16 w-16 text-primary" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">
              Registration Submitted!
            </h1>
            <p className="text-lg text-muted-foreground">
              Thank you for registering with Emerald CFZE
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3 text-left">
              <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Review in Progress</p>
                <p className="text-sm text-muted-foreground">
                  Our procurement team will review your application within 3-5 business days.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 text-left">
              <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Email Notification</p>
                <p className="text-sm text-muted-foreground">
                  You will receive an email notification once your registration has been approved, along with your login credentials.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 space-y-3">
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => navigate("/vendor-portal")}
            >
              Continue to Vendor Portal
            </Button>
            <p className="text-xs text-muted-foreground">
              Already have credentials? You can login from the vendor portal.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorRegistrationSuccess;
