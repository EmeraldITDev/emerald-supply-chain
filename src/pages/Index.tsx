import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Package, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent">
      <div className="text-center space-y-8 px-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary rounded-2xl mb-4 shadow-lg">
          <Package className="h-10 w-10 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-5xl font-bold mb-4 text-foreground">Supply Chain Management</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Streamline your procurement, logistics, inventory, and warehouse operations
          </p>
        </div>
        <Button size="lg" onClick={() => navigate("/auth")} className="group">
          Get Started
          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
};

export default Index;
