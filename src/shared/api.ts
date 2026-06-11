import type {
  ApiResult,
  ClusterOverview,
  ConnectionStatus,
  KubeContextInfo,
  LogOptions,
  PodDetail,
  ResourceKind,
  ResourceList
} from './types';

/**
 * The complete surface the renderer can reach, exposed on `window.kubelube`
 * by the preload script. The renderer stays fully sandboxed from Node and
 * Electron internals.
 */
export interface KubelubeApi {
  listContexts(): Promise<ApiResult<KubeContextInfo[]>>;
  useContext(name: string): Promise<ApiResult<ConnectionStatus>>;
  reloadKubeconfig(): Promise<ApiResult<KubeContextInfo[]>>;
  getConnectionStatus(): Promise<ApiResult<ConnectionStatus>>;
  listNamespaces(): Promise<ApiResult<string[]>>;
  listResources(kind: ResourceKind, namespace?: string): Promise<ApiResult<ResourceList>>;
  getResourceYaml(kind: ResourceKind, name: string, namespace?: string): Promise<ApiResult<string>>;
  deleteResource(kind: ResourceKind, name: string, namespace?: string): Promise<ApiResult<void>>;
  getPodDetail(namespace: string, name: string): Promise<ApiResult<PodDetail>>;
  getPodLogs(opts: LogOptions): Promise<ApiResult<string>>;
  getOverview(): Promise<ApiResult<ClusterOverview>>;
  scaleWorkload(
    kind: 'deployments' | 'statefulsets',
    namespace: string,
    name: string,
    replicas: number
  ): Promise<ApiResult<void>>;
}
