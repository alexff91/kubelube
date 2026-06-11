import * as k8s from '@kubernetes/client-node';
import { dump } from 'js-yaml';
import type {
  ClusterOverview,
  ConnectionStatus,
  KubeContextInfo,
  LogOptions,
  PodDetail,
  ResourceKind,
  ResourceList
} from '@shared/types';
import { buildResourceList, KIND_META } from './resources';

function errorMessage(err: unknown): string {
  if (err instanceof k8s.ApiException) {
    try {
      const parsed = JSON.parse(String(err.body)) as { message?: string };
      if (parsed.message) return parsed.message;
    } catch {
      // body was not JSON, fall through to the generic message
    }
    return `API error (HTTP ${err.code})`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Owns the kubeconfig and all API clients. Lives in the main process; the
 * renderer reaches it through the IPC handlers registered in ipc.ts.
 */
export class KubeService {
  private kc = new k8s.KubeConfig();
  private loadError?: string;

  constructor() {
    this.reload();
  }

  reload(): void {
    this.kc = new k8s.KubeConfig();
    this.loadError = undefined;
    try {
      this.kc.loadFromDefault();
    } catch (err) {
      this.loadError = errorMessage(err);
    }
  }

  private core(): k8s.CoreV1Api {
    return this.kc.makeApiClient(k8s.CoreV1Api);
  }

  private apps(): k8s.AppsV1Api {
    return this.kc.makeApiClient(k8s.AppsV1Api);
  }

  private batch(): k8s.BatchV1Api {
    return this.kc.makeApiClient(k8s.BatchV1Api);
  }

  private networking(): k8s.NetworkingV1Api {
    return this.kc.makeApiClient(k8s.NetworkingV1Api);
  }

  private objects(): k8s.KubernetesObjectApi {
    return k8s.KubernetesObjectApi.makeApiClient(this.kc);
  }

  listContexts(): KubeContextInfo[] {
    if (this.loadError) throw new Error(this.loadError);
    const current = this.kc.getCurrentContext();
    return this.kc.getContexts().map((ctx) => ({
      name: ctx.name,
      cluster: ctx.cluster,
      user: ctx.user,
      namespace: ctx.namespace ?? undefined,
      isCurrent: ctx.name === current
    }));
  }

  async useContext(name: string): Promise<ConnectionStatus> {
    if (this.loadError) throw new Error(this.loadError);
    this.kc.setCurrentContext(name);
    return this.getConnectionStatus();
  }

  async getConnectionStatus(): Promise<ConnectionStatus> {
    if (this.loadError) {
      return { connected: false, error: this.loadError };
    }
    const contextName = this.kc.getCurrentContext();
    if (!contextName) {
      return { connected: false, error: 'No current context in kubeconfig' };
    }
    try {
      const version = await this.kc.makeApiClient(k8s.VersionApi).getCode();
      return { connected: true, contextName, clusterVersion: version.gitVersion };
    } catch (err) {
      return { connected: false, contextName, error: errorMessage(err) };
    }
  }

  async listNamespaces(): Promise<string[]> {
    const list = await this.core().listNamespace();
    return list.items.map((ns) => ns.metadata?.name ?? '').filter(Boolean);
  }

  async listResources(kind: ResourceKind, namespace?: string): Promise<ResourceList> {
    return buildResourceList(kind, namespace, {
      core: this.core(),
      apps: this.apps(),
      batch: this.batch(),
      networking: this.networking()
    });
  }

  async getResourceYaml(kind: ResourceKind, name: string, namespace?: string): Promise<string> {
    const meta = KIND_META[kind];
    const obj = await this.objects().read({
      apiVersion: meta.apiVersion,
      kind: meta.kind,
      metadata: { name, namespace: meta.namespaced ? namespace : undefined }
    });
    if (obj.metadata) {
      delete obj.metadata.managedFields;
    }
    return dump(obj, { noRefs: true, sortKeys: false });
  }

  async deleteResource(kind: ResourceKind, name: string, namespace?: string): Promise<void> {
    const meta = KIND_META[kind];
    await this.objects().delete({
      apiVersion: meta.apiVersion,
      kind: meta.kind,
      metadata: { name, namespace: meta.namespaced ? namespace : undefined }
    });
  }

  async getPodDetail(namespace: string, name: string): Promise<PodDetail> {
    const pod = await this.core().readNamespacedPod({ name, namespace });
    const statuses = pod.status?.containerStatuses ?? [];
    const containers = (pod.spec?.containers ?? []).map((c) => {
      const status = statuses.find((s) => s.name === c.name);
      let state = 'Unknown';
      if (status?.state?.running) state = 'Running';
      else if (status?.state?.waiting) state = status.state.waiting.reason ?? 'Waiting';
      else if (status?.state?.terminated) state = status.state.terminated.reason ?? 'Terminated';
      return {
        name: c.name,
        image: c.image ?? '',
        ready: status?.ready ?? false,
        restartCount: status?.restartCount ?? 0,
        state
      };
    });
    return {
      name,
      namespace,
      nodeName: pod.spec?.nodeName,
      phase: pod.status?.phase ?? 'Unknown',
      podIP: pod.status?.podIP,
      containers
    };
  }

  async getPodLogs(opts: LogOptions): Promise<string> {
    const log = await this.core().readNamespacedPodLog({
      name: opts.pod,
      namespace: opts.namespace,
      container: opts.container,
      tailLines: opts.tailLines ?? 500,
      previous: opts.previous ?? false,
      timestamps: false
    });
    return log ?? '';
  }

  async scaleWorkload(
    kind: 'deployments' | 'statefulsets',
    namespace: string,
    name: string,
    replicas: number
  ): Promise<void> {
    const apps = this.apps();
    if (kind === 'deployments') {
      const scale = await apps.readNamespacedDeploymentScale({ name, namespace });
      scale.spec = { ...scale.spec, replicas };
      await apps.replaceNamespacedDeploymentScale({ name, namespace, body: scale });
    } else {
      const scale = await apps.readNamespacedStatefulSetScale({ name, namespace });
      scale.spec = { ...scale.spec, replicas };
      await apps.replaceNamespacedStatefulSetScale({ name, namespace, body: scale });
    }
  }

  async getOverview(): Promise<ClusterOverview> {
    const contextName = this.kc.getCurrentContext();
    const [version, nodes, namespaces, pods, deployments, events] = await Promise.all([
      this.kc.makeApiClient(k8s.VersionApi).getCode(),
      this.core().listNode(),
      this.core().listNamespace(),
      this.core().listPodForAllNamespaces(),
      this.apps().listDeploymentForAllNamespaces(),
      this.core().listEventForAllNamespaces({ fieldSelector: 'type=Warning', limit: 20 })
    ]);

    const readyNodes = nodes.items.filter((n) =>
      n.status?.conditions?.some((c) => c.type === 'Ready' && c.status === 'True')
    ).length;

    const podPhases = { running: 0, pending: 0, failed: 0, succeeded: 0 };
    for (const pod of pods.items) {
      const phase = (pod.status?.phase ?? '').toLowerCase();
      if (phase in podPhases) podPhases[phase as keyof typeof podPhases] += 1;
    }

    const readyDeployments = deployments.items.filter(
      (d) => (d.status?.readyReplicas ?? 0) >= (d.spec?.replicas ?? 0)
    ).length;

    const warningEvents = events.items
      .slice(-10)
      .reverse()
      .map((e) => ({
        reason: e.reason ?? '',
        object: `${e.involvedObject?.kind ?? ''}/${e.involvedObject?.name ?? ''}`,
        message: e.message ?? '',
        lastSeen: e.lastTimestamp ? new Date(e.lastTimestamp).toISOString() : undefined
      }));

    return {
      contextName,
      clusterVersion: version.gitVersion,
      nodes: { total: nodes.items.length, ready: readyNodes },
      namespaces: namespaces.items.length,
      pods: { total: pods.items.length, ...podPhases },
      deployments: { total: deployments.items.length, ready: readyDeployments },
      warningEvents
    };
  }
}

export { errorMessage };
