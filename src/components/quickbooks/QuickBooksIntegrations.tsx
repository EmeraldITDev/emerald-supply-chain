import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  quickbooksApi,
  type QuickBooksPoPull,
  type QuickBooksSupplierMappings,
  type QuickBooksSupplierReconciliation,
  type QuickBooksSupplierRow,
} from "@/services/api";
import { getScmRole } from "@/utils/scmRole";
import { useAuth } from "@/contexts/AuthContext";
import {
  bannerKind,
  callbackErrorMessage,
  canConnect,
  canDisconnect,
  canManageSupplierReconciliation,
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
  const showSupplierReconciliation = canManageSupplierReconciliation(role);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const handledCallback = useRef("");
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [loadSetup, setLoadSetup] = useState(false);
  const [connectionForbidden, setConnectionForbidden] = useState(false);
  const [reconciliation, setReconciliation] = useState<QuickBooksSupplierReconciliation | null>(null);
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

  const reconciliationQuery = useQuery({
    queryKey: ["quickbooks", "supplier-reconciliation"],
    queryFn: () => quickbooksApi.supplierReconciliation(),
    enabled: false,
    retry: false,
  });

  const mappingVendorIds = Array.from(new Set(
    (reconciliation?.matched ?? [])
      .map((row) => row.scm_vendor_id)
      .filter((id): id is number => typeof id === "number"),
  ));
  const mappingQueries = useQueries({
    queries: mappingVendorIds.map((vendorId) => ({
      queryKey: ["quickbooks", "supplier-mappings", vendorId],
      queryFn: () => quickbooksApi.supplierMappings(vendorId),
      enabled: showSupplierReconciliation && status?.connected === true,
      staleTime: 30_000,
      retry: false,
    })),
  });
  const mappingsByVendorId = new Map(
    mappingVendorIds.map((vendorId, index) => [vendorId, mappingQueries[index]?.data?.success ? mappingQueries[index].data.data : undefined]),
  );

  const refreshReconciliation = async () => {
    const response = await reconciliationQuery.refetch();
    if (!response.data?.success || !response.data.data) {
      toast.error(response.data?.error ?? quickBooksErrorMessage(response.data?.code, response.data?.status));
      return;
    }
    setReconciliation(response.data.data);
    toast.success("Supplier reconciliation preview loaded.");
  };

  const reconcileMutationOptions = {
    onSuccess: async (response: { success: boolean; data?: unknown; error?: string; code?: string; status?: number }) => {
      if (!response.success) {
        toast.error(response.error ?? quickBooksErrorMessage(response.code, response.status));
        return;
      }
      toast.success("Supplier reconciliation action completed.");
      await queryClient.invalidateQueries({ queryKey: ["quickbooks", "supplier-reconciliation"] });
      await queryClient.invalidateQueries({ queryKey: ["quickbooks", "supplier-mappings"] });
      await refreshReconciliation();
    },
  };

  const approveMapping = useMutation({
    mutationFn: (row: QuickBooksSupplierRow) => quickbooksApi.approveSupplierMapping({
      vendor_id: row.scm_vendor_id!,
      quickbooks_vendor_id: row.quickbooks_vendor_id!,
      currency: row.currency!,
      match_method: row.match_method ?? "manual",
    }),
    ...reconcileMutationOptions,
  });

  const decideMapping = useMutation({
    mutationFn: ({ mappingId, status }: { mappingId: number; status: "rejected" | "deferred" }) =>
      quickbooksApi.decideSupplierMapping(mappingId, status),
    ...reconcileMutationOptions,
  });

  const importSupplier = useMutation({
    mutationFn: (row: QuickBooksSupplierRow) => quickbooksApi.importSupplier(row.id!, row.currency!),
    ...reconcileMutationOptions,
  });

  const prepareCreation = useMutation({
    mutationFn: ({ vendorId, currency }: { vendorId: number; currency: string }) =>
      quickbooksApi.prepareSupplierCreation(vendorId, currency),
    ...reconcileMutationOptions,
  });

  const approveCreation = useMutation({
    mutationFn: (requestId: number) => quickbooksApi.approveSupplierCreation(requestId),
    ...reconcileMutationOptions,
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

      {status?.connected && showSupplierReconciliation && (
        <Card>
          <CardHeader>
            <CardTitle>Supplier reconciliation</CardTitle>
            <CardDescription>
              Read-only QuickBooks preview. No mapping, import, or vendor creation happens automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={refreshReconciliation} disabled={reconciliationQuery.isFetching}>
              {reconciliationQuery.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Retrieve supplier preview
            </Button>
            {reconciliationQuery.data && !reconciliationQuery.data.success && (
              <Alert variant="destructive">
                <AlertTitle>Reconciliation failed</AlertTitle>
                <AlertDescription>
                  {reconciliationQuery.data.error ?? quickBooksErrorMessage(reconciliationQuery.data.code, reconciliationQuery.data.status)}
                </AlertDescription>
              </Alert>
            )}
            {reconciliation && (
              <>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline">{reconciliation.matched.length} matched</Badge>
                  <Badge variant="outline">{reconciliation.unmatched.length} unmatched</Badge>
                  <span className="text-muted-foreground">Currencies: {reconciliation.supported_currencies.join(", ")}</span>
                </div>
                <SupplierReconciliationTable
                  rows={reconciliation.matched}
                  mappingsByVendorId={mappingsByVendorId}
                  onApprove={(row) => approveMapping.mutate(row)}
                  onDecision={(mappingId, decision) => decideMapping.mutate({ mappingId, status: decision })}
                  onPrepareCreation={(vendorId, currency) => prepareCreation.mutate({ vendorId, currency })}
                  onApproveCreation={(requestId) => approveCreation.mutate(requestId)}
                  pending={approveMapping.isPending || decideMapping.isPending || prepareCreation.isPending || approveCreation.isPending}
                />
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Unmatched QuickBooks suppliers</h3>
                  <p className="text-sm text-muted-foreground">Import creates a pending SCM supplier and mapping for later review; it does not create a QuickBooks vendor.</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>QuickBooks supplier</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reconciliation.unmatched.length === 0 ? (
                        <TableRow><TableCell colSpan={5}>No unmatched suppliers.</TableCell></TableRow>
                      ) : reconciliation.unmatched.map((row) => (
                        <TableRow key={`${row.id}-${row.currency}`}>
                          <TableCell>{dash(row.display_name || row.company_name)}</TableCell>
                          <TableCell><Badge variant="outline">{dash(row.currency)}</Badge></TableCell>
                          <TableCell>{dash(row.email)}</TableCell>
                          <TableCell><Badge variant="secondary">Unmatched</Badge></TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => importSupplier.mutate(row)}
                              disabled={importSupplier.isPending || !row.id || !row.currency}
                            >
                              {importSupplier.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                              Import as pending
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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

function SupplierReconciliationTable({
  rows,
  mappingsByVendorId,
  onApprove,
  onDecision,
  onPrepareCreation,
  onApproveCreation,
  pending,
}: {
  rows: QuickBooksSupplierRow[];
  mappingsByVendorId: Map<number, QuickBooksSupplierMappings | undefined>;
  onApprove: (row: QuickBooksSupplierRow) => void;
  onDecision: (mappingId: number, status: "rejected" | "deferred") => void;
  onPrepareCreation: (vendorId: number, currency: string) => void;
  onApproveCreation: (requestId: number) => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Matched and review-required suppliers</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SCM supplier</TableHead>
            <TableHead>QuickBooks supplier</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead>Match status</TableHead>
            <TableHead>Linked currency profiles</TableHead>
            <TableHead>Review action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={6}>No matched suppliers.</TableCell></TableRow>
          ) : rows.map((row) => {
            const vendorId = row.scm_vendor_id;
            const details = vendorId ? mappingsByVendorId.get(vendorId) : undefined;
            const approved = row.mapping_status === "approved";
            const reviewRequired = row.match_status !== "matched" || row.conflict === true;
            return (
              <TableRow key={`${row.scm_vendor_id ?? "review"}-${row.quickbooks_vendor_id ?? row.id}`}>
                <TableCell>{dash(row.scm_vendor_name ?? (row.candidate_scm_vendor_ids?.length ? `Candidates: ${row.candidate_scm_vendor_ids.join(", ")}` : null))}</TableCell>
                <TableCell>
                  <div>{dash(row.quickbooks_name)}</div>
                  <div className="text-xs text-muted-foreground">ID: {dash(row.quickbooks_vendor_id)}</div>
                </TableCell>
                <TableCell><Badge variant="outline">{dash(row.currency)}</Badge></TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Badge variant={reviewRequired ? "destructive" : approved ? "default" : "secondary"}>
                      {reviewRequired ? "Review required" : approved ? "Mapping approved" : "Matched"}
                    </Badge>
                    <div className="text-xs text-muted-foreground">{dash(row.match_method)}</div>
                  </div>
                </TableCell>
                <TableCell>
                  {details ? (
                    <div className="space-y-1 text-xs">
                      {details.mappings.length === 0 ? <div className="text-muted-foreground">No mappings.</div> : details.mappings.map((mapping) => (
                        <div key={mapping.id}>
                          <Badge variant={mapping.status === "approved" ? "default" : "outline"}>{mapping.currency}</Badge>{" "}
                          <span>{mapping.quickbooks_vendor_id} · {mapping.status}</span>
                        </div>
                      ))}
                      {details.creation_requests.map((request) => (
                        <div key={`request-${request.id}`} className="flex flex-wrap items-center gap-1">
                          <span>{request.currency} creation request · {request.status}</span>
                          {request.status === "pending" && (
                            <Button size="sm" variant="ghost" onClick={() => onApproveCreation(request.id)} disabled={pending}>
                              Approve request
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">Loading profiles…</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {!reviewRequired && !approved && vendorId && row.quickbooks_vendor_id && row.currency && (
                      <Button size="sm" onClick={() => onApprove(row)} disabled={pending}>
                        Approve mapping
                      </Button>
                    )}
                    {row.mapping_id && row.mapping_status !== "approved" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => onDecision(row.mapping_id!, "deferred")} disabled={pending}>
                          Defer
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onDecision(row.mapping_id!, "rejected")} disabled={pending}>
                          Reject
                        </Button>
                      </>
                    )}
                    {vendorId && row.currency && !approved && (
                      <Button size="sm" variant="outline" onClick={() => onPrepareCreation(vendorId, row.currency!)} disabled={pending}>
                        Prepare vendor request
                      </Button>
                    )}
                    {reviewRequired && <span className="text-xs text-muted-foreground">Resolve identity before approval.</span>}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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
