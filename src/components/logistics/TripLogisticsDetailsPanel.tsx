import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BedDouble,
  Car,
  FileText,
  Receipt,
  ShieldCheck,
  Truck,
  UserCog,
  Users,
} from "lucide-react";
import { formatPoAmount } from "@/utils/currency";
import type { StaffTripRequest, TripRfq } from "@/types/trip-request";

interface PassengerItem {
  key: string;
  name: string;
  department?: string;
  email?: string;
  phone?: string;
  external?: boolean;
}

type AnyRecord = Record<string, unknown>;

/** Read the first defined value across snake_case / camelCase aliases. */
function pick<T = unknown>(source: AnyRecord | null | undefined, ...keys: string[]): T | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value as T;
  }
  return undefined;
}

function money(value: unknown, currency = "NGN"): string {
  if (value == null || value === "") return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return formatPoAmount(num, currency);
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border/40 bg-background/60 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

const SERVICE_LABELS: Record<string, string> = {
  transport: "Transport",
  accommodation: "Accommodation",
  escort: "Escort / Security",
};

export interface TripLogisticsDetailsPanelProps {
  /** Full trip-request record from GET /api/trip-requests/{id}?include_progress=true */
  trip: StaffTripRequest | AnyRecord | null | undefined;
  /** Optional linked logistics trip record used to fill gaps (vehicle/driver/vendor). */
  logisticsTrip?: AnyRecord | null;
  /** Hide the passengers block when the host view already renders one. */
  showPassengers?: boolean;
}

/**
 * Renders every logistics-planning field attached to a trip record:
 * passengers, vehicle & driver, vendors, accommodation, escort,
 * documents/quotations and the estimated cost breakdown.
 */
export function TripLogisticsDetailsPanel({
  trip,
  logisticsTrip,
  showPassengers = true,
}: TripLogisticsDetailsPanelProps) {
  if (!trip && !logisticsTrip) return null;
  const t = (trip ?? {}) as AnyRecord;
  const lt = (logisticsTrip ?? {}) as AnyRecord;

  const passengers =
    (pick<AnyRecord[]>(t, "passengers") ?? pick<AnyRecord[]>(lt, "passengers") ?? []) as AnyRecord[];
  const externalPassengers = (pick<AnyRecord[]>(
    t,
    "externalPassengers",
    "external_passengers",
  ) ?? pick<AnyRecord[]>(lt, "externalPassengers", "external_passengers") ?? []) as AnyRecord[];
  const passengerUserIds = (pick<number[]>(
    t,
    "passengerUserIds",
    "passenger_user_ids",
  ) ?? pick<number[]>(lt, "passengerUserIds", "passenger_user_ids") ?? []) as number[];
  const includedUsers = (pick<AnyRecord[]>(
    t,
    "includedUsers",
    "included_users",
    "users",
  ) ?? pick<AnyRecord[]>(lt, "includedUsers", "included_users", "users") ?? []) as AnyRecord[];

  const userMatchesId = (item: AnyRecord | unknown, userId: unknown): boolean => {
    if (!item || typeof item !== "object") return false;
    const idValues = [
      (item as AnyRecord).id,
      (item as AnyRecord).user_id,
      (item as AnyRecord).userId,
      (item as AnyRecord).staffId,
      (item as AnyRecord).staff_id,
    ];
    return idValues.some((candidate) => String(candidate) === String(userId));
  };

  const resolveUserById = (userId: unknown): AnyRecord | undefined => {
    return (
      includedUsers.find((item) => userMatchesId(item, userId)) ??
      passengers.find((item) => userMatchesId(item, userId))
    );
  };

  const resolvedInternalPassengers: PassengerItem[] = passengerUserIds.map((userId, index) => {
    const user = resolveUserById(userId);
    const nameRaw =
      user?.name ?? user?.fullName ?? user?.full_name ?? user?.displayName ?? user?.display_name ??
      user?.firstName ?? user?.first_name ?? user?.lastName ?? user?.last_name ?? null;
    const name = nameRaw == null || String(nameRaw).trim() === "" ? String(userId) : String(nameRaw);
    const deptRaw = user?.department ?? user?.department_name ?? user?.departmentName ?? null;
    const department = deptRaw == null ? undefined : String(deptRaw);
    const emailRaw = user?.email ?? user?.email_address ?? user?.emailAddress ?? null;
    const email = emailRaw == null ? undefined : String(emailRaw);
    return {
      key: `int-${userId}-${index}`,
      name,
      department,
      email,
      external: false,
    };
  });

  const resolvedExternalPassengers: PassengerItem[] = externalPassengers.map((p, index) => ({
    key: `ext-${index}`,
    name: String(p.name ?? p.full_name ?? p.fullName ?? "—"),
    phone: String(p.phone ?? "") || undefined,
    email: String(p.email ?? "") || undefined,
    external: true,
  }));

  const unifiedPassengers = [...resolvedInternalPassengers, ...resolvedExternalPassengers];

  // --- Vehicle -------------------------------------------------------------
  const vehicleObj = (pick<AnyRecord>(t, "vehicle") ?? pick<AnyRecord>(lt, "vehicle")) as
    | AnyRecord
    | undefined;
  const vehiclePlate =
    pick<string>(t, "vehiclePlate", "vehicle_plate") ??
    pick<string>(lt, "vehiclePlate", "vehicle_plate") ??
    pick<string>(vehicleObj, "plateNumber", "plate_number", "plate");
  const vehicleMake =
    pick<string>(t, "vehicleMake", "vehicle_make") ??
    pick<string>(lt, "vehicleMake", "vehicle_make") ??
    pick<string>(vehicleObj, "make");
  const vehicleModel =
    pick<string>(t, "vehicleModel", "vehicle_model") ??
    pick<string>(lt, "vehicleModel", "vehicle_model") ??
    pick<string>(vehicleObj, "model");
  const vehicleType =
    pick<string>(t, "vehicleType", "vehicle_type") ??
    pick<string>(lt, "vehicleType", "vehicle_type") ??
    pick<string>(vehicleObj, "type", "vehicleType");
  const hasVehicle = Boolean(vehiclePlate || vehicleMake || vehicleModel || vehicleType);

  // --- Driver --------------------------------------------------------------
  const externalDriver = (pick<AnyRecord>(t, "externalDriver", "external_driver") ??
    pick<AnyRecord>(lt, "externalDriver", "external_driver")) as AnyRecord | undefined;
  const driverName =
    pick<string>(t, "driverName", "driver_name") ??
    pick<string>(lt, "driverName", "driver_name") ??
    pick<string>(externalDriver, "name");
  const driverPhone =
    pick<string>(t, "driverPhone", "driver_phone") ??
    pick<string>(lt, "driverPhone", "driver_phone") ??
    pick<string>(externalDriver, "phone");
  const driverType =
    pick<string>(t, "driverType", "driver_type", "driverSource", "driver_source") ??
    pick<string>(lt, "driverType", "driver_type") ??
    (externalDriver ? "external" : driverName ? "internal" : undefined);
  const hasDriver = Boolean(driverName || driverPhone);

  // --- Vendors -------------------------------------------------------------
  const transportVendor =
    pick<string>(t, "transportVendorName", "transport_vendor_name", "vendorName", "vendor_name") ??
    pick<string>(lt, "vendorName", "vendor_name");
  const accommodationVendor = pick<string>(
    t,
    "accommodationVendorName",
    "accommodation_vendor_name",
  );
  const escortVendor = pick<string>(t, "escortVendorName", "escort_vendor_name");

  // --- Accommodation / escort ---------------------------------------------
  const accommodationRequired = Boolean(
    pick(t, "accommodationRequired", "accommodation_required"),
  );
  const accName = pick<string>(t, "accommodationName", "accommodation_name");
  const accAddress = pick<string>(t, "accommodationAddress", "accommodation_address");
  const accContact = pick<string>(t, "accommodationContact", "accommodation_contact");
  const accDetails = pick<string>(t, "accommodationDetails", "accommodation_details");
  const accCost = pick(t, "accommodationEstimatedCost", "accommodation_estimated_cost");
  const escortRequired = Boolean(pick(t, "escortRequired", "escort_required"));
  const escortDescription = pick<string>(t, "escortDescription", "escort_description");
  const escortCost = pick(t, "escortEstimatedCost", "escort_estimated_cost");

  // --- Quotations / documents / costs -------------------------------------
  const rfqs = (pick<TripRfq[]>(t, "rfqs") ?? []) as TripRfq[];
  const documents = (pick<AnyRecord[]>(t, "documents", "attachments", "supporting_documents") ??
    pick<AnyRecord[]>(lt, "documents", "attachments") ??
    []) as AnyRecord[];
  const transportCost = pick(t, "transportEstimatedCost", "transport_estimated_cost");
  const totalCost =
    pick(t, "totalEstimatedCost", "total_estimated_cost") ??
    pick(t, "estimatedCost", "estimated_cost");

  const costRows: Array<{ label: string; value: unknown }> = [
    { label: "Transport", value: transportCost },
    { label: "Accommodation", value: accCost },
    { label: "Escort / Security", value: escortCost },
  ].filter((row) => row.value != null);

  return (
    <div className="space-y-3">
      {showPassengers && (
        <Section
          title={`Passengers (${unifiedPassengers.length})`}
          icon={<Users className="h-4 w-4 text-primary" />}
        >
          {unifiedPassengers.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No passengers assigned yet.</p>
          ) : (
            <div className="space-y-1.5">
              {unifiedPassengers.map((p) => (
                <div
                  key={p.key}
                  className="flex flex-wrap items-center gap-2 rounded border border-border/40 bg-muted/30 px-2 py-1.5 text-sm"
                >
                  <span className="font-medium">{p.name}</span>
                  {p.external ? (
                    <Badge variant="outline" className="text-[10px]">
                      External
                    </Badge>
                  ) : (
                    p.department ? (
                      <span className="text-xs text-muted-foreground">{p.department}</span>
                    ) : null
                  )}
                  {p.phone ? (
                    <span className="text-xs text-muted-foreground">{p.phone}</span>
                  ) : null}
                  {p.email ? (
                    <span className="text-xs text-muted-foreground">{p.email}</span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Section title="Vehicle" icon={<Car className="h-4 w-4 text-primary" />}>
          {hasVehicle ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Plate" value={vehiclePlate ?? "—"} />
              <Field label="Type" value={vehicleType ?? "—"} />
              <Field label="Make" value={vehicleMake ?? "—"} />
              <Field label="Model" value={vehicleModel ?? "—"} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No vehicle assigned yet.</p>
          )}
        </Section>

        <Section title="Driver" icon={<UserCog className="h-4 w-4 text-primary" />}>
          {hasDriver ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name" value={driverName ?? "—"} />
              <Field label="Phone" value={driverPhone ?? "—"} />
              <Field
                label="Source"
                value={
                  driverType ? (
                    <Badge variant="outline" className="capitalize">
                      {String(driverType)}
                    </Badge>
                  ) : (
                    "—"
                  )
                }
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No driver assigned yet.</p>
          )}
        </Section>
      </div>

      {(transportVendor || accommodationVendor || escortVendor) && (
        <Section title="Vendors" icon={<Truck className="h-4 w-4 text-primary" />}>
          <div className="grid gap-2 sm:grid-cols-3">
            {transportVendor && <Field label="Transport" value={transportVendor} />}
            {accommodationVendor && <Field label="Accommodation" value={accommodationVendor} />}
            {escortVendor && <Field label="Escort" value={escortVendor} />}
          </div>
        </Section>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Section title="Accommodation" icon={<BedDouble className="h-4 w-4 text-primary" />}>
          <p className="text-xs">
            <span className="font-medium">Required:</span>{" "}
            <span className={accommodationRequired ? "text-primary" : "text-muted-foreground"}>
              {accommodationRequired ? "Yes" : "No"}
            </span>
          </p>
          {accommodationRequired ? (
            accName || accAddress || accContact || accDetails || accCost != null ? (
              <div className="space-y-1 text-xs text-muted-foreground">
                {accName && (
                  <div>
                    <span className="font-medium text-foreground">Hotel:</span> {accName}
                  </div>
                )}
                {accAddress && (
                  <div>
                    <span className="font-medium text-foreground">Address:</span> {accAddress}
                  </div>
                )}
                {accContact && (
                  <div>
                    <span className="font-medium text-foreground">Contact:</span> {accContact}
                  </div>
                )}
                {accDetails && (
                  <div>
                    <span className="font-medium text-foreground">Notes:</span> {accDetails}
                  </div>
                )}
                {accCost != null && (
                  <div>
                    <span className="font-medium text-foreground">Est. cost:</span> {money(accCost)}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Accommodation requested — details pending from logistics.
              </p>
            )
          ) : (
            <p className="text-xs text-muted-foreground">No accommodation required.</p>
          )}
        </Section>

        <Section title="Escort / Security" icon={<ShieldCheck className="h-4 w-4 text-primary" />}>
          <p className="text-xs">
            <span className="font-medium">Required:</span>{" "}
            <span className={escortRequired ? "text-primary" : "text-muted-foreground"}>
              {escortRequired ? "Yes" : "No"}
            </span>
          </p>
          {escortRequired ? (
            <div className="space-y-1 text-xs text-muted-foreground">
              {escortDescription ? (
                <p>{escortDescription}</p>
              ) : (
                <p className="italic">Escort requested — details pending from logistics.</p>
              )}
              {escortCost != null && (
                <div>
                  <span className="font-medium text-foreground">Est. cost:</span> {money(escortCost)}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No escort required.</p>
          )}
        </Section>
      </div>

      {(rfqs.length > 0 || documents.length > 0) && (
        <Section title="Documents & Quotations" icon={<FileText className="h-4 w-4 text-primary" />}>
          <div className="space-y-1.5">
            {rfqs.map((rfq) => (
              <div
                key={String(rfq.id)}
                className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5 text-xs"
              >
                <span className="font-medium">
                  {SERVICE_LABELS[rfq.service_type] ?? rfq.service_type} · {rfq.vendor_name}
                </span>
                <span className="flex items-center gap-2">
                  <span>{money(rfq.quoted_price, rfq.currency)}</span>
                  {rfq.is_recommended && <Badge variant="secondary">Recommended</Badge>}
                  {rfq.document_url && (
                    <a
                      href={rfq.document_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      View
                    </a>
                  )}
                </span>
              </div>
            ))}
            {documents.map((doc, i) => {
              const url = pick<string>(doc, "url", "file_url", "document_url", "path");
              const name = pick<string>(doc, "name", "file_name", "title") ?? `Document ${i + 1}`;
              return (
                <div
                  key={`doc-${i}`}
                  className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2 py-1.5 text-xs"
                >
                  <span>{name}</span>
                  {url && (
                    <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">
                      View
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {(costRows.length > 0 || totalCost != null) && (
        <Section title="Estimated Cost" icon={<Receipt className="h-4 w-4 text-primary" />}>
          <div className="space-y-1 text-xs">
            {costRows.map((row) => (
              <div key={row.label} className="flex justify-between">
                <span className="text-muted-foreground">{row.label}</span>
                <span>{money(row.value)}</span>
              </div>
            ))}
            {costRows.length > 0 && totalCost != null && <Separator className="my-1" />}
            {totalCost != null && (
              <div className="flex justify-between text-sm font-semibold">
                <span>Total estimated cost</span>
                <span>{money(totalCost)}</span>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

export default TripLogisticsDetailsPanel;
