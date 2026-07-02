import type { MRF } from '@/types';
import type { SRF } from '@/types';
import type { TableExportColumn } from '@/utils/tableExport';
import { getDisplayId } from '@/utils/displayId';
import { getSrfRequesterDisplayName } from '@/utils/srfRequester';
import type { RFQ } from '@/contexts/AppContext';

export const MRF_EXPORT_COLUMNS: TableExportColumn<MRF>[] = [
  { key: 'id', label: 'MRF ID', value: (m) => getDisplayId(m) || m.id },
  { key: 'title', label: 'Title', value: (m) => m.title },
  { key: 'requester', label: 'Requester', value: (m) => m.requester_name || m.requester || '' },
  { key: 'department', label: 'Department', value: (m) => m.department || '' },
  { key: 'status', label: 'Status', value: (m) => m.status || '' },
  {
    key: 'stage',
    label: 'Workflow Stage',
    value: (m) => String(m.current_stage || m.currentStage || m.workflow_state || m.workflowState || ''),
  },
  {
    key: 'estimated_cost',
    label: 'Estimated Cost',
    value: (m) => String(m.estimated_cost ?? m.estimatedCost ?? ''),
  },
  {
    key: 'po_number',
    label: 'PO Number',
    value: (m) => m.po_number || m.poNumber || '',
  },
  {
    key: 'created_at',
    label: 'Created',
    value: (m) => String(m.created_at || (m as any).createdAt || (m as any).date || ''),
  },
];

export const PO_EXPORT_COLUMNS: TableExportColumn<MRF>[] = [
  { key: 'po_number', label: 'PO Number', value: (m) => m.po_number || m.poNumber || '' },
  { key: 'mrf_id', label: 'MRF ID', value: (m) => getDisplayId(m) || m.id },
  { key: 'title', label: 'Title', value: (m) => m.title },
  { key: 'status', label: 'Status', value: (m) => m.status || '' },
  {
    key: 'stage',
    label: 'Workflow Stage',
    value: (m) => String(m.workflow_state || m.workflowState || m.current_stage || ''),
  },
  {
    key: 'estimated_cost',
    label: 'Estimated Cost',
    value: (m) => String(m.estimated_cost ?? m.estimatedCost ?? ''),
  },
  {
    key: 'created_at',
    label: 'Created',
    value: (m) => String(m.created_at || (m as any).createdAt || ''),
  },
];

export const SRF_EXPORT_COLUMNS: TableExportColumn<SRF & { requester?: string }>[] = [
  { key: 'id', label: 'SRF ID', value: (s) => getDisplayId(s) || String(s.id) },
  { key: 'title', label: 'Title', value: (s) => s.title },
  { key: 'requester', label: 'Requester', value: (s) => getSrfRequesterDisplayName(s) },
  { key: 'department', label: 'Department', value: (s) => s.department || '' },
  { key: 'status', label: 'Status', value: (s) => s.status || '' },
  {
    key: 'stage',
    label: 'Workflow Stage',
    value: (s) => String(s.workflow_state || s.workflowState || s.current_stage || ''),
  },
  {
    key: 'estimated_cost',
    label: 'Estimated Cost',
    value: (s) => String(s.estimated_cost ?? s.estimatedCost ?? ''),
  },
  {
    key: 'created_at',
    label: 'Created',
    value: (s) => String(s.createdAt || s.created_at || s.date || ''),
  },
];

export const RFQ_EXPORT_COLUMNS: TableExportColumn<RFQ>[] = [
  { key: 'id', label: 'RFQ ID', value: (r) => getDisplayId(r) || r.id },
  { key: 'mrf', label: 'Linked MRF', value: (r) => r.mrfTitle || r.mrfId || '' },
  { key: 'status', label: 'Status', value: (r) => r.status || '' },
  { key: 'deadline', label: 'Deadline', value: (r) => r.deadline || '' },
  { key: 'budget', label: 'Budget', value: (r) => r.estimatedCost || '' },
  { key: 'created', label: 'Created', value: (r) => r.createdDate || '' },
];

export type TripExportRow = {
  id: string;
  tripCode?: string;
  type?: string;
  status?: string;
  origin?: string;
  destination?: string;
  departureDate?: string;
  workflowStage?: string;
};

export const TRIP_EXPORT_COLUMNS: TableExportColumn<TripExportRow>[] = [
  { key: 'id', label: 'Trip ID', value: (t) => t.tripCode || t.id },
  { key: 'type', label: 'Type', value: (t) => t.type || '' },
  { key: 'status', label: 'Status', value: (t) => t.status || '' },
  { key: 'origin', label: 'Origin', value: (t) => t.origin || '' },
  { key: 'destination', label: 'Destination', value: (t) => t.destination || '' },
  { key: 'departure', label: 'Departure', value: (t) => t.departureDate || '' },
  { key: 'workflow', label: 'Workflow Stage', value: (t) => t.workflowStage || '' },
];
