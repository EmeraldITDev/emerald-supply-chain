import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfitAndLoss } from "@/types";
import { AlertCircle, TrendingDown, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ProfitAndLossTableProps {
  pnl: ProfitAndLoss | undefined;
  isLoading?: boolean;
}

export const ProfitAndLossTable = ({ pnl, isLoading = false }: ProfitAndLossTableProps) => {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Budget vs Actuals Analysis</CardTitle>
          <CardDescription>Line-item profit and loss breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pnl || pnl.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Budget vs Actuals Analysis</CardTitle>
          <CardDescription>Line-item profit and loss breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No line items available for analysis. Add items to your MRF/SRF to see budget vs. actuals.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget vs Actuals Analysis</CardTitle>
        <CardDescription>Line-item profit and loss breakdown</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="text-sm font-medium text-muted-foreground">Total Budget</div>
            <div className="text-2xl font-bold mt-2">
              ₦{pnl.summary.totalBudget.toLocaleString()}
            </div>
          </div>
          
          <div className="p-4 rounded-lg border bg-muted/50">
            <div className="text-sm font-medium text-muted-foreground">Total Quoted</div>
            <div className="text-2xl font-bold mt-2">
              ₦{pnl.summary.totalQuoted.toLocaleString()}
            </div>
          </div>
          
          <div className={`p-4 rounded-lg border ${pnl.summary.totalSavings > 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-muted/50'}`}>
            <div className="text-sm font-medium text-muted-foreground">Total Savings</div>
            <div className="text-2xl font-bold mt-2 flex items-center gap-2">
              {pnl.summary.totalSavings > 0 ? (
                <>
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span className="text-green-600">₦{pnl.summary.totalSavings.toLocaleString()}</span>
                </>
              ) : (
                <span>₦{pnl.summary.totalSavings.toLocaleString()}</span>
              )}
            </div>
          </div>
          
          <div className={`p-4 rounded-lg border ${pnl.summary.totalLoss > 0 ? 'bg-red-50 dark:bg-red-950' : 'bg-muted/50'}`}>
            <div className="text-sm font-medium text-muted-foreground">Total Loss</div>
            <div className="text-2xl font-bold mt-2 flex items-center gap-2">
              {pnl.summary.totalLoss > 0 ? (
                <>
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <span className="text-red-600">₦{pnl.summary.totalLoss.toLocaleString()}</span>
                </>
              ) : (
                <span>₦{pnl.summary.totalLoss.toLocaleString()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead className="text-right">Budget Amount (₦)</TableHead>
                <TableHead className="text-right">Quoted Amount (₦)</TableHead>
                <TableHead className="text-right">Variance (₦)</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pnl.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.itemName}</TableCell>
                  <TableCell className="text-right">₦{item.budgetAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-right">₦{item.quotedAmount.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-semibold ${
                    item.varianceType === 'saving' ? 'text-green-600' : 
                    item.varianceType === 'loss' ? 'text-red-600' : 
                    'text-muted-foreground'
                  }`}>
                    ₦{item.variance.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.varianceType === 'saving' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                      item.varianceType === 'loss' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {item.varianceType === 'saving' ? '✓ Saving' : 
                       item.varianceType === 'loss' ? '✗ Loss' : 'Neutral'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Net Variance */}
        <div className={`p-4 rounded-lg border-2 ${
          pnl.summary.netVariance >= 0 
            ? 'border-green-200 bg-green-50 dark:bg-green-950' 
            : 'border-red-200 bg-red-50 dark:bg-red-950'
        }`}>
          <div className="text-sm font-medium text-muted-foreground">Net Variance</div>
          <div className={`text-3xl font-bold mt-2 flex items-center gap-2 ${
            pnl.summary.netVariance >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {pnl.summary.netVariance >= 0 ? (
              <>
                <TrendingUp className="h-6 w-6" />
                ₦{pnl.summary.netVariance.toLocaleString()}
              </>
            ) : (
              <>
                <TrendingDown className="h-6 w-6" />
                ₦{Math.abs(pnl.summary.netVariance).toLocaleString()}
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Based on {pnl.summary.lineCount} line items
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
