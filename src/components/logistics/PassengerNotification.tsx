import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  CheckCircle2,
  Clock,
  User,
  Truck,
  MapPin,
  Phone,
  Calendar,
  Send,
  XCircle,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Trip, TripPassenger } from "@/types/logistics";

interface PassengerNotificationProps {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendNotifications?: () => Promise<void>;
}

interface NotificationStatus {
  passengerId: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: string;
}

export const PassengerNotification = ({
  trip,
  open,
  onOpenChange,
  onSendNotifications,
}: PassengerNotificationProps) => {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [notificationStatuses, setNotificationStatuses] = useState<NotificationStatus[]>(
    trip.passengers?.map(p => ({ passengerId: p.id, status: p.notifiedAt ? 'sent' : 'pending', sentAt: p.notifiedAt })) || []
  );

  const handleSendNotifications = async () => {
    setIsSending(true);
    try {
      // Simulate sending notifications
      const pendingPassengers = trip.passengers?.filter(
        p => !notificationStatuses.find(s => s.passengerId === p.id)?.sentAt
      ) || [];

      for (const passenger of pendingPassengers) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setNotificationStatuses(prev => 
          prev.map(s => 
            s.passengerId === passenger.id 
              ? { ...s, status: 'sent' as const, sentAt: new Date().toISOString() }
              : s
          )
        );
      }

      if (onSendNotifications) {
        await onSendNotifications();
      }

      toast({
        title: "Notifications Sent",
        description: `${pendingPassengers.length} passenger(s) have been notified via email`,
      });
    } catch (error) {
      toast({
        title: "Notification Failed",
        description: "Failed to send some notifications",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const sentCount = notificationStatuses.filter(s => s.status === 'sent').length;
  const pendingCount = notificationStatuses.filter(s => s.status === 'pending').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Passenger Notifications
          </DialogTitle>
          <DialogDescription>
            Trip {trip.tripNumber} - Notify passengers of trip details
          </DialogDescription>
        </DialogHeader>

        {/* Trip Summary Card */}
        <Card className="bg-muted/30">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Trip Details (Sent to Passengers)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Route</p>
                  <p className="font-medium">{trip.origin} → {trip.destination}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground text-xs">Departure</p>
                  <p className="font-medium">
                    {new Date(trip.scheduledDepartureAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            
            {trip.driverName && (
              <div className="pt-3 border-t">
                <p className="text-xs text-muted-foreground mb-2">Driver & Vehicle Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">{trip.driverName}</p>
                      {trip.driverPhone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {trip.driverPhone}
                        </p>
                      )}
                    </div>
                  </div>
                  {trip.vehiclePlate && (
                    <div className="flex items-start gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">{trip.vehicleType || "Vehicle"}</p>
                        <p className="text-xs text-muted-foreground">{trip.vehiclePlate}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notification Status */}
        <div className="flex items-center justify-between">
          <div className="flex gap-4">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-success" />
              {sentCount} Sent
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3 text-warning" />
              {pendingCount} Pending
            </Badge>
          </div>
          <Button
            onClick={handleSendNotifications}
            disabled={isSending || pendingCount === 0}
            size="sm"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Pending ({pendingCount})
              </>
            )}
          </Button>
        </div>

        {/* Passengers Table */}
        {trip.passengers && trip.passengers.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Passenger</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Pickup</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trip.passengers.map((passenger) => {
                    const status = notificationStatuses.find(s => s.passengerId === passenger.id);
                    return (
                      <TableRow key={passenger.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{passenger.name}</p>
                            <p className="text-xs text-muted-foreground">{passenger.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {passenger.department}
                        </TableCell>
                        <TableCell className="text-sm">
                          {passenger.pickupLocation || trip.origin}
                        </TableCell>
                        <TableCell className="text-center">
                          {status?.status === 'sent' ? (
                            <Badge className="bg-success/10 text-success gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Sent
                            </Badge>
                          ) : status?.status === 'failed' ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Failed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Alert>
            <AlertDescription className="text-sm text-muted-foreground">
              No passengers assigned to this trip yet.
            </AlertDescription>
          </Alert>
        )}

        {/* Email Preview */}
        <Card className="border-primary/20">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Email Preview</CardTitle>
            <CardDescription>Content sent to passengers</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div className="p-4 rounded-lg bg-muted/30 space-y-2">
              <p className="font-semibold">Subject: Your Trip Details - {trip.tripNumber}</p>
              <hr className="border-muted" />
              <p>Dear [Passenger Name],</p>
              <p>
                You have been scheduled for a trip. Please find the details below:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Route:</strong> {trip.origin} → {trip.destination}</li>
                <li><strong>Date:</strong> {new Date(trip.scheduledDepartureAt).toLocaleDateString()}</li>
                <li><strong>Time:</strong> {new Date(trip.scheduledDepartureAt).toLocaleTimeString()}</li>
                {trip.driverName && <li><strong>Driver:</strong> {trip.driverName}</li>}
                {trip.driverPhone && <li><strong>Driver Phone:</strong> {trip.driverPhone}</li>}
                {trip.vehiclePlate && <li><strong>Vehicle:</strong> {trip.vehicleType} - {trip.vehiclePlate}</li>}
              </ul>
              <p className="text-muted-foreground">
                Please be at the pickup location on time. Contact the driver if you have any questions.
              </p>
              <p className="text-muted-foreground">
                Best regards,<br />
                Logistics Team
              </p>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default PassengerNotification;
