import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye } from "lucide-react";
import type { SrfWithUi } from "@/types/srf-ui";
import {
  lineItemsFromSrf,
  srfUiActionVisible,
} from "@/types/srf-ui";
import { getDisplayId } from "@/utils/displayId";

interface SRFCardListProps {
  srfs: SrfWithUi[];
  getStatusColor: (status: string) => string;
  onOpenSrf: (srf: SrfWithUi) => void;
  onOpenLineItem: (srf: SrfWithUi, lineItemId: string, fetchPath?: string) => void;
}

export function SRFCardList({
  srfs,
  getStatusColor,
  onOpenSrf,
  onOpenLineItem,
}: SRFCardListProps) {
  return (
    <div className="space-y-4">
      {srfs.map((srf) => {
        const lineItems = lineItemsFromSrf(srf);
        const cardClickable = srf.ui?.cardClickable !== false;
        const cardAction = srf.ui?.viewDetails;
        const showCardDetails = srfUiActionVisible(cardAction);

        const openCard = () => {
          if (!cardClickable && !showCardDetails) return;
          onOpenSrf(srf);
        };

        return (
          <Card
            key={srf.id}
            className={
              cardClickable || showCardDetails
                ? "cursor-pointer hover:shadow-md transition-shadow"
                : undefined
            }
            onClick={cardClickable ? openCard : undefined}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold">{srf.title}</h3>
                  <p className="text-sm text-muted-foreground">{getDisplayId(srf)}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge className={getStatusColor(srf.status)}>{srf.status}</Badge>
                  {showCardDetails && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSrf(srf);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      {cardAction?.label ?? "View Details"}
                    </Button>
                  )}
                </div>
              </div>

              {lineItems.length > 0 ? (
                <div
                  className="space-y-2 border-t pt-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    Line items
                  </p>
                  {lineItems.map((item) => {
                    const name = item.itemName ?? item.item_name ?? "Item";
                    const ps = item.progressSummary;
                    const lineAction = item.ui?.viewDetails;
                    const showLine = srfUiActionVisible(lineAction);
                    return (
                      <div
                        key={String(item.id)}
                        className="flex items-center justify-between gap-2 text-sm border rounded-lg p-2"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{name}</p>
                          {ps?.currentStepLabel && (
                            <p className="text-xs text-muted-foreground truncate">
                              {ps.currentStepLabel}
                            </p>
                          )}
                        </div>
                        {showLine && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              onOpenLineItem(
                                srf,
                                String(item.id),
                                lineAction!.path,
                              )
                            }
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            {lineAction?.label ?? "View Details"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground border-t pt-3">
                  No line items on this request.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default SRFCardList;
