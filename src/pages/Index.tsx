import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Package, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent relative p-4">
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4">
        <ThemeToggle />
      </div>
      <div className="text-center space-y-6 sm:space-y-8 px-4 max-w-4xl">
        <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-primary rounded-2xl mb-2 sm:mb-4 shadow-lg animate-scale-in">
          <Package className="h-8 w-8 sm:h-10 sm:w-10 text-primary-foreground" />
        </div>
        <div className="animate-fade-in">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 text-foreground leading-tight">Supply Chain Management</h1>
          <p className="text-sm sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto">
            Streamline your procurement, logistics, inventory, and warehouse operations
          </p>
        </div>
        <Button size="lg" onClick={() => navigate("/auth")} className="group transition-transform hover:scale-105 text-sm sm:text-base">
          Get Started
          <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
};

export default Index;
