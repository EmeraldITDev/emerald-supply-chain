import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Construction } from "lucide-react";

interface PlaceholderModuleProps {
  title: string;
  description: string;
}

const PlaceholderModule = ({ title, description }: PlaceholderModuleProps) => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-2">{description}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Construction className="h-5 w-5 text-primary" />
              Coming Soon
            </CardTitle>
            <CardDescription>This module is under development</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <Construction className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                The {title} module will be available in the next phase of development.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                We're working hard to bring you this feature soon!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PlaceholderModule;
