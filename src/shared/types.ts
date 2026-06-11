/**
 * Shared data contracts between the Electron main process and the renderer.
 * The renderer never talks to the Kubernetes API directly: every payload that
 * crosses the IPC bridge is a plain, serializable shape defined here.
 */

export interface KubeContextInfo {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
  isCurrent: boolean;
}

export interface ConnectionStatus {
  connected: boolean;
  contextName?: string;
  clusterVersion?: string;
  error?: string;
}

export type ResourceKind =
  | 'pods'
  | 'deployments'
  | 'statefulsets'
  | 'daemonsets'
  | 'replicasets'
  | 'jobs'
  | 'cronjobs'
  | 'services'
  | 'ingresses'
  | 'configmaps'
  | 'secrets'
  | 'persistentvolumeclaims'
  | 'nodes'
  | 'namespaces'
  | 'events';

/** A column of a resource table. */
export interface ResourceColumn {
  key: string;
  label: string;
  /** Hint for the renderer: render as a status badge instead of plain text. */
  badge?: boolean;
}

/** One row of a resource table, already flattened by the main process. */
export interface ResourceRow {
  /** Stable identity: `${namespace}/${name}` or just `name` for cluster-scoped resources. */
  uid: string;
  name: string;
  namespace?: string;
  creationTimestamp?: string;
  /** Values keyed by ResourceColumn.key. */
  cells: Record<string, string>;
  /** Coarse health used for row accents: ok | warn | err | none. */
  health: 'ok' | 'warn' | 'err' | 'none';
}

export interface ResourceList {
  kind: ResourceKind;
  columns: ResourceColumn[];
  rows: ResourceRow[];
}

export interface PodContainerInfo {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state: string;
}

export interface PodDetail {
  name: string;
  namespace: string;
  nodeName?: string;
  phase: string;
  podIP?: string;
  containers: PodContainerInfo[];
}

export interface LogOptions {
  namespace: string;
  pod: string;
  container?: string;
  tailLines?: number;
  previous?: boolean;
}

export interface ClusterOverview {
  contextName: string;
  clusterVersion: string;
  nodes: { total: number; ready: number };
  namespaces: number;
  pods: { total: number; running: number; pending: number; failed: number; succeeded: number };
  deployments: { total: number; ready: number };
  warningEvents: { reason: string; object: string; message: string; lastSeen?: string }[];
}

export interface ApiError {
  message: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** Channel names used across the IPC bridge. */
export const IPC = {
  listContexts: 'kube:listContexts',
  useContext: 'kube:useContext',
  reloadKubeconfig: 'kube:reloadKubeconfig',
  getConnectionStatus: 'kube:getConnectionStatus',
  listNamespaces: 'kube:listNamespaces',
  listResources: 'kube:listResources',
  getResourceYaml: 'kube:getResourceYaml',
  deleteResource: 'kube:deleteResource',
  getPodDetail: 'kube:getPodDetail',
  getPodLogs: 'kube:getPodLogs',
  getOverview: 'kube:getOverview',
  scaleWorkload: 'kube:scaleWorkload'
} as const;
