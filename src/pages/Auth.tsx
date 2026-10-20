import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrandLogo } from "@/components/BrandLogo";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true); // Default to true for persistent login
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { login, isAuthenticated, loading } = useAuth();

  const [isLoading, setIsLoading] = useState(false);

  // Redirect to dashboard (or returnTo destination from email deep link) if already logged in
  useEffect(() => {
    if (!loading && isAuthenticated) {
      const returnTo = searchParams.get("returnTo");
      navigate(returnTo ? decodeURIComponent(returnTo) : "/dashboard", { replace: true });
    }
  }, [isAuthenticated, loading, navigate, searchParams]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const result = await login(email, password, rememberMe);
    
    if (result.success) {
      toast({
        title: "Welcome!",
        description: "Successfully signed in to SCM system",
      });
      
      const returnTo = searchParams.get("returnTo");
      navigate(returnTo ? decodeURIComponent(returnTo) : "/dashboard");
    } else {
      toast({
        title: "Login Failed",
        description: result.error || "Invalid credentials. Please check your email and password.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 animate-scale-in">
            <BrandLogo width={64} height={64} className="h-16 w-16" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">SCM Platform</h1>
          <p className="text-muted-foreground">Supply Chain Management System</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Sign in to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <Label
                  htmlFor="remember"
                  className="text-sm font-normal cursor-pointer"
                >
                  Keep me signed in
                </Label>
              </div>
              <Button type="submit" className="w-full transition-transform hover:scale-105" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              By signing in you agree to our{" "}
              <Link to="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/vendor-portal" className="hover:text-foreground hover:underline">
            Vendor Portal
          </Link>
          {" · "}
          <Link to="/terms" className="hover:text-foreground hover:underline">
            Terms
          </Link>
          {" · "}
          <Link to="/privacy" className="hover:text-foreground hover:underline">
            Privacy
          </Link>
        </p>

      </div>
    </div>
  );
};

export default Auth;
