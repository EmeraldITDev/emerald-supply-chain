import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { quickbooksApi, type QuickBooksPoPull, type QuickBooksVendorPull } from "@/services/api";
import { getScmRole } from "@/utils/scmRole";
import { useAuth } from "@/contexts/AuthContext";
import {
  bannerKind,
  callbackErrorMessage,
  canConnect,
  canDisconnect,
  canUseSetupHelper,
  dash,
  quickBooksErrorMessage,
  readCallbackQuery,
  stripCallbackParams,
  type QuickBooksStatus,
} from "@/components/quickbooks/quickbooksLogic";

function formatStamp(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "d MMM yyyy, HH:mm");
}

function connectionLabel(status: QuickBooksStatus): string {
  if (status.needs_reconnect) return "Reconnect required";
  if (status.connected) return "Connected";
  return "Not connected";
}

export function QuickBooksIntegrations() {
  const { user } = useAuth();
  const role = getScmRole(user);
  const showConnect = canConnect(role);
  const showDisconnect = canDisconnect(role);
  const showSetupHelper = canUseSetupHelper(role);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledCallback = useRef("");
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [loadSetup, setLoadSetup] = useState(false);
  const [connectionForbidden, setConnectionForbidden] = useState(false);
  const [vendors, setVendors] = useState<QuickBooksVendorPull | null>(null);
  const [purchaseOrders, setPurchaseOrders] = useState<QuickBooksPoPull | null>(null);

  const statusQuery = useQuery({
    queryKey: ["quickbooks", "status"],
    queryFn: () => quickbooksApi.status(),
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    const callback = readCallbackQuery(searchParams);
    if (!callback.connected && !callback.error) return;
    const key = searchParams.toString();
    if (handledCallback.current === key) return;
    handledCallback.current = key;
    if (callback.connected) toast.success("QuickBooks is connected.");
    if (callback.error) toast.error(callbackErrorMessage(callback.error) ?? "QuickBooks could not connect.");
    setSearchParams(stripCallbackParams(searchParams), { replace: true });
    void queryClient.invalidateQueries({ queryKey: ["quickbooks", "status"] });
  }, [queryClient, searchParams, setSearchParams]);

  const status = statusQuery.data?.success ? statusQuery.data.data : undefined;
  const forbidden = statusQuery.data?.status === 403 || statusQuery.data?.code === "FORBIDDEN";
  const banner = status ? bannerKind(status) : "none";

  const connect = useMutation({
    mutationFn: () => quickbooksApi.connect(),
    onSuccess: (response) => {
      if (response.status === 403 || response.code === "FORBIDDEN") {
        setConnectionForbidden(true);
        toast.error(quickBooksErrorMessage(response.code, response.status));
        return;
      }
      const url = response.data?.authorization_url;
      if (!response.success || !url) {
        toast.error(quickBooksErrorMessage(response.code, response.status));
        return;
      }
      window.location.href = url;
    },
  });

  const disconnect = useMutation({
    mutationFn: () => quickbooksApi.disconnect(),
    onSuccess: async (response) => {
      if (response.status === 403 || response.code === "FORBIDDEN") {
        setConnectionForbidden(true);
        toast.error(quickBooksErrorMessage(response.code, response.status));
        setDisconnectOpen(false);
        return;
      }
      if (!response.success) {
        toast.error(quickBooksErrorMessage(response.code, response.status));
        return;
      }
      toast.success("QuickBooks access was revoked.");
      setDisconnectOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["quickbooks", "status"] });
    },
  });

  const accountsQuery = useQuery({
    queryKey: ["quickbooks", "accounts-items"],
    queryFn: () => quickbooksApi.inspectAccountsItems(),
    enabled: showSetupHelper && !connectionForbidden && loadSetup && status?.connected === true,
    staleTime: 60_000,
    retry: false,
  });

  useEffect(() => {
    if (accountsQuery.data?.status === 403 || accountsQuery.data?.code === "FORBIDDEN") {
      setConnectionForbidden(true);
    }
  }, [accountsQuery.data]);

  const pullVendors = useMutation({
    mutationFn: () => quickbooksApi.pullVendors(),
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast.error(quickBooksErrorMessage(response.code, response.status));
        return;
      }
      setVendors(response.data);
      toast.success("Vendor matching finished.");
    },
  });

  const pullOrders = useMutation({
    mutationFn: () => quickbooksApi.pullPurchaseOrders(),
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast.error(quickBooksErrorMessage(response.code, response.status));
        return;
      }
      setPurchaseOrders(response.data);
      toast.success("Purchase order status refreshed.");
    },
  });

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      toast.success("ID copied.");
    } catch {
      toast.error("Could not copy that ID.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>QuickBooks connection</CardTitle>
          <CardDescription>Connection status only. Tokens and the company realm are not shown.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusQuery.isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading QuickBooks status">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : forbidden ? (
            <p className="text-sm text-muted-foreground">You do not have permission to view QuickBooks.</p>
          ) : !status ? (
            <p className="text-sm text-muted-foreground">{quickBooksErrorMessage(statusQuery.data?.code, statusQuery.data?.status)}</p>
          ) : (
            <>
              <Badge variant={status.connected && !status.needs_reconnect ? "default" : "outline"}>
                {connectionLabel(status)}
              </Badge>
              <dl className="grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Connected</dt>
                  <dd>{formatStamp(status.connected_at)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Access token expires</dt>
                  <dd>{formatStamp(status.access_token_expires_at)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Refresh token expires</dt>
                  <dd>{formatStamp(status.refresh_token_expires_at)}</dd>
                </div>
              </dl>
              {(showConnect || showDisconnect) && !connectionForbidden && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {showConnect && (
                      <Button
                        onClick={() => connect.mutate()}
                        disabled={connect.isPending || (status.connected && !status.needs_reconnect)}
                      >
                        {connect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Connect
                      </Button>
                    )}
                    {showDisconnect && (
                      <Button
                        variant="outline"
                        onClick={() => setDisconnectOpen(true)}
                        disabled={!status.connected && !status.needs_reconnect}
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                  {showConnect && (
                    <p className="text-sm text-muted-foreground">
                      You must sign in to QuickBooks with a user who is an administrator of the company file.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {status && banner === "live" && (
        <Alert variant="destructive">
          <AlertTitle>Live mode</AlertTitle>
          <AlertDescription>LIVE MODE: POs will be posted to your real QuickBooks books.</AlertDescription>
        </Alert>
      )}
      {status && banner === "dry_run" && (
        <Alert className="border-amber-500/60 bg-amber-500/10 text-amber-950 dark:text-amber-50">
          <AlertTitle>Dry run</AlertTitle>
          <AlertDescription>
            Dry-run mode: nothing is sent to QuickBooks.
            {!status.writes_enabled && " Writes disabled."}
          </AlertDescription>
        </Alert>
      )}
      {status && banner === "writes_disabled" && (
        <Alert className="border-amber-500/60 bg-amber-500/10">
          <AlertTitle>Writes disabled</AlertTitle>
          <AlertDescription>Writes disabled. Purchase orders will not be posted.</AlertDescription>
        </Alert>
      )}
      {status && !status.default_line_ref_configured && (
        <Alert>
          <AlertTitle>No default line reference</AlertTitle>
          <AlertDescription>
            No default Item or Expense Account set. PO sync will fail until one is configured. Set
            QUICKBOOKS_DEFAULT_ITEM_ID or QUICKBOOKS_DEFAULT_EXPENSE_ACCOUNT_ID on the server.
          </AlertDescription>
        </Alert>
      )}

      {showSetupHelper && !connectionForbidden && status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle>Find your default Item or Account</CardTitle>
            <CardDescription>
              Copy an ID into QUICKBOOKS_DEFAULT_ITEM_ID or QUICKBOOKS_DEFAULT_EXPENSE_ACCOUNT_ID on the server.
              This screen cannot save that value.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" onClick={() => setLoadSetup(true)} disabled={accountsQuery.isFetching}>
              {accountsQuery.isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Load accounts and items
            </Button>
            {accountsQuery.data && !accountsQuery.data.success && (
              <p className="text-sm text-muted-foreground">
                {quickBooksErrorMessage(accountsQuery.data.code, accountsQuery.data.status)}
              </p>
            )}
            {accountsQuery.data?.success && accountsQuery.data.data && (
              <div className="grid gap-6 lg:grid-cols-2">
                <ReferenceTable
                  title="Accounts"
                  typeKey="AccountType"
                  rows={accountsQuery.data.data.accounts}
                  onCopy={copyId}
                />
                <ReferenceTable
                  title="Items"
                  typeKey="Type"
                  rows={accountsQuery.data.data.items}
                  onCopy={copyId}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle>Vendor matching</CardTitle>
            <CardDescription>Matches existing SCM vendors. QuickBooks vendors are not created in SCM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={() => pullVendors.mutate()} disabled={pullVendors.isPending}>
              {pullVendors.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Pull vendors from QuickBooks
            </Button>
            {vendors && (
              <>
                <p className="text-sm text-muted-foreground">
                  {vendors.matched.length} matched, {vendors.unmatched.length} unmatched
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SCM vendor</TableHead>
                      <TableHead>QuickBooks name</TableHead>
                      <TableHead>Match</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendors.matched.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3}>No matched vendors.</TableCell>
                      </TableRow>
                    ) : vendors.matched.map((row) => (
                      <TableRow key={`${row.scm_vendor_id}-${row.quickbooks_vendor_id}`}>
                        <TableCell>{dash(row.scm_vendor_name ?? row.scm_vendor_id)}</TableCell>
                        <TableCell>{dash(row.quickbooks_name)}</TableCell>
                        <TableCell>{row.conflict ? "Conflict" : row.match_method === "email" ? "Email" : row.match_method === "name" ? "Name" : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <h3 className="text-sm font-medium">Unmatched QuickBooks vendors</h3>
                {vendors.unmatched.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {vendors.unmatched.map((row) => (
                      <li key={row.id}>{dash(row.display_name || row.company_name)}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle>Purchase order status</CardTitle>
            <CardDescription>Refresh status for purchase orders already linked to QuickBooks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" onClick={() => pullOrders.mutate()} disabled={pullOrders.isPending}>
              {pullOrders.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Refresh PO status from QuickBooks
            </Button>
            {purchaseOrders && (
              <>
                <p className="text-sm">
                  {purchaseOrders.updated.filter((row) => row.updated).length} linked purchase orders updated.
                </p>
                <h3 className="text-sm font-medium">Not linked to SCM</h3>
                {purchaseOrders.unlinked.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None.</p>
                ) : (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {purchaseOrders.unlinked.map((row) => (
                      <li key={row.id}>
                        {dash(row.doc_number)} · {dash(row.po_status)} · {dash(row.id)}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect QuickBooks</AlertDialogTitle>
            <AlertDialogDescription>
              This revokes SCM&apos;s access to QuickBooks for everyone. Synced PO links are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReferenceTable({
  title,
  typeKey,
  rows,
  onCopy,
}: {
  title: string;
  typeKey: "AccountType" | "Type";
  rows: Array<{ Id: string | null; Name: string | null; AccountType?: string | null; Type?: string | null }>;
  onCopy: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Id</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="sr-only">Copy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>No rows.</TableCell>
            </TableRow>
          ) : rows.map((row) => (
            <TableRow key={`${title}-${row.Id ?? row.Name}`}>
              <TableCell>{dash(row.Id)}</TableCell>
              <TableCell>{dash(row.Name)}</TableCell>
              <TableCell>{dash(row[typeKey])}</TableCell>
              <TableCell>
                {row.Id ? (
                  <Button type="button" size="sm" variant="ghost" aria-label={`Copy ID for ${row.Name || "row"}`} onClick={() => onCopy(row.Id!)}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copy ID
                  </Button>
                ) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
