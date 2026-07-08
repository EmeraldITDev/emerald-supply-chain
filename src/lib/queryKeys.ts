/** Central React Query keys — use factories so invalidation stays targeted. */

export const queryKeys = {
  mrfs: {
    all: ['mrfs'] as const,
    list: (params: Record<string, unknown>) => ['mrfs', 'list', params] as const,
    detail: (id: string) => ['mrfs', 'detail', id] as const,
    progressTracker: (id: string) => ['mrfs', 'progress-tracker', id] as const,
  },
  pos: {
    all: ['pos'] as const,
    list: (params: Record<string, unknown>) => ['pos', 'list', params] as const,
  },
  vendors: {
    all: ['vendors'] as const,
    list: (params: Record<string, unknown>) => ['vendors', 'list', params] as const,
    detail: (id: string) => ['vendors', 'detail', id] as const,
  },
  users: {
    all: ['users'] as const,
    list: (filters: Record<string, unknown>) => ['users', 'list', filters] as const,
  },
  departments: {
    all: ['departments'] as const,
    requisitionCreators: () => ['departments', 'requisition-creators'] as const,
  },
  rfqs: {
    all: ['rfqs'] as const,
    list: (params: Record<string, unknown>) => ['rfqs', 'list', params] as const,
  },
  srfs: {
    all: ['srfs'] as const,
    list: (params: Record<string, unknown>) => ['srfs', 'list', params] as const,
  },
  reports: {
    all: ['reports'] as const,
    dashboard: (from: string, to: string) => ['reports', 'dashboard', from, to] as const,
    procurement: (from: string, to: string) => ['reports', 'procurement', from, to] as const,
    procurementRecords: (params: Record<string, unknown>) =>
      ['reports', 'procurement-records', params] as const,
    procurementRecordDetail: (id: number) =>
      ['reports', 'procurement-record-detail', id] as const,
    financeAp: {
      summary: (from: string, to: string) => ['reports', 'finance-ap', 'summary', from, to] as const,
      outstanding: (from: string, to: string, limit: number) =>
        ['reports', 'finance-ap', 'outstanding', from, to, limit] as const,
      advanceRisk: (limit: number) => ['reports', 'finance-ap', 'advance-risk', limit] as const,
      cycleTimes: (from: string, to: string) => ['reports', 'finance-ap', 'cycle-times', from, to] as const,
    },
  },
  dashboard: {
    all: ['dashboard'] as const,
    procurementManager: () => ['dashboard', 'procurement-manager'] as const,
    supplyChainDirector: () => ['dashboard', 'supply-chain-director'] as const,
    supplyChainDirectorRaw: () => ['dashboard', 'supply-chain-director', 'raw'] as const,
    executiveRaw: () => ['dashboard', 'executive', 'raw'] as const,
    recentActivities: (limit: number) => ['dashboard', 'recent-activities', limit] as const,
    executiveMrfs: () => ['dashboard', 'executive', 'mrfs'] as const,
    chairmanMrfs: () => ['dashboard', 'chairman', 'mrfs'] as const,
    scdMrfs: () => ['dashboard', 'scd', 'mrfs'] as const,
    departmentMrfs: (userId: string | number | undefined) =>
      ['dashboard', 'department', 'mrfs', userId] as const,
    pendingVendorRegistrations: () => ['dashboard', 'pending-vendor-registrations'] as const,
  },
} as const;
