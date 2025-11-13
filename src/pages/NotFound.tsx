import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center max-w-md w-full">
        <h1 className="mb-3 sm:mb-4 text-5xl sm:text-6xl lg:text-7xl font-bold text-foreground">404</h1>
        <p className="mb-4 sm:mb-6 text-lg sm:text-xl lg:text-2xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary-hover text-sm sm:text-base transition-colors">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
