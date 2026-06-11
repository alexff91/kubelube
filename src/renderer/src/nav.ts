import type { ResourceKind } from '@shared/types';

export type ViewId = 'overview' | ResourceKind;

export interface NavItem {
  id: ViewId;
  label: string;
  icon: string;
}

export interface NavGroup {
  title?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { id: 'overview', label: 'Overview', icon: 'grid' },
      { id: 'nodes', label: 'Nodes', icon: 'server' },
      { id: 'namespaces', label: 'Namespaces', icon: 'folder' },
      { id: 'events', label: 'Events', icon: 'zap' }
    ]
  },
  {
    title: 'Workloads',
    items: [
      { id: 'pods', label: 'Pods', icon: 'box' },
      { id: 'deployments', label: 'Deployments', icon: 'layers' },
      { id: 'statefulsets', label: 'StatefulSets', icon: 'database' },
      { id: 'daemonsets', label: 'DaemonSets', icon: 'copy' },
      { id: 'replicasets', label: 'ReplicaSets', icon: 'copy' },
      { id: 'jobs', label: 'Jobs', icon: 'clock' },
      { id: 'cronjobs', label: 'CronJobs', icon: 'clock' }
    ]
  },
  {
    title: 'Network',
    items: [
      { id: 'services', label: 'Services', icon: 'share' },
      { id: 'ingresses', label: 'Ingresses', icon: 'globe' }
    ]
  },
  {
    title: 'Config & Storage',
    items: [
      { id: 'configmaps', label: 'ConfigMaps', icon: 'file' },
      { id: 'secrets', label: 'Secrets', icon: 'lock' },
      { id: 'persistentvolumeclaims', label: 'Volume Claims', icon: 'hdd' }
    ]
  }
];

const LABELS = new Map<ViewId, string>(
  NAV_GROUPS.flatMap((g) => g.items).map((item) => [item.id, item.label])
);

export function viewLabel(id: ViewId): string {
  return LABELS.get(id) ?? id;
}

/** Views that list cluster-scoped resources and ignore the namespace filter. */
export const CLUSTER_SCOPED: ReadonlySet<ViewId> = new Set(['overview', 'nodes', 'namespaces']);
