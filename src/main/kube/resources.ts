import type * as k8s from '@kubernetes/client-node';
import type { ResourceColumn, ResourceKind, ResourceList, ResourceRow } from '@shared/types';

interface Clients {
  core: k8s.CoreV1Api;
  apps: k8s.AppsV1Api;
  batch: k8s.BatchV1Api;
  networking: k8s.NetworkingV1Api;
}

interface KindMeta {
  apiVersion: string;
  kind: string;
  namespaced: boolean;
}

export const KIND_META: Record<ResourceKind, KindMeta> = {
  pods: { apiVersion: 'v1', kind: 'Pod', namespaced: true },
  deployments: { apiVersion: 'apps/v1', kind: 'Deployment', namespaced: true },
  statefulsets: { apiVersion: 'apps/v1', kind: 'StatefulSet', namespaced: true },
  daemonsets: { apiVersion: 'apps/v1', kind: 'DaemonSet', namespaced: true },
  replicasets: { apiVersion: 'apps/v1', kind: 'ReplicaSet', namespaced: true },
  jobs: { apiVersion: 'batch/v1', kind: 'Job', namespaced: true },
  cronjobs: { apiVersion: 'batch/v1', kind: 'CronJob', namespaced: true },
  services: { apiVersion: 'v1', kind: 'Service', namespaced: true },
  ingresses: { apiVersion: 'networking.k8s.io/v1', kind: 'Ingress', namespaced: true },
  configmaps: { apiVersion: 'v1', kind: 'ConfigMap', namespaced: true },
  secrets: { apiVersion: 'v1', kind: 'Secret', namespaced: true },
  persistentvolumeclaims: { apiVersion: 'v1', kind: 'PersistentVolumeClaim', namespaced: true },
  nodes: { apiVersion: 'v1', kind: 'Node', namespaced: false },
  namespaces: { apiVersion: 'v1', kind: 'Namespace', namespaced: false },
  events: { apiVersion: 'v1', kind: 'Event', namespaced: true }
};

export function formatAge(timestamp?: Date | string): string {
  if (!timestamp) return '';
  const then = new Date(timestamp).getTime();
  if (Number.isNaN(then)) return '';
  let seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const days = Math.floor(seconds / 86400);
  if (days >= 10) return `${days}d`;
  seconds -= days * 86400;
  const hours = Math.floor(seconds / 3600);
  if (days > 0) return `${days}d${hours}h`;
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  if (hours > 0) return `${hours}h${minutes}m`;
  seconds -= minutes * 60;
  if (minutes > 0) return `${minutes}m${seconds}s`;
  return `${seconds}s`;
}

function baseRow(meta: k8s.V1ObjectMeta | undefined, namespaced: boolean): Omit<ResourceRow, 'cells' | 'health'> {
  const name = meta?.name ?? '';
  const namespace = namespaced ? (meta?.namespace ?? '') : undefined;
  return {
    uid: namespace ? `${namespace}/${name}` : name,
    name,
    namespace,
    creationTimestamp: meta?.creationTimestamp
      ? new Date(meta.creationTimestamp).toISOString()
      : undefined
  };
}

const AGE: ResourceColumn = { key: 'age', label: 'Age' };

async function listPods(c: Clients, namespace?: string): Promise<ResourceList> {
  const list = namespace
    ? await c.core.listNamespacedPod({ namespace })
    : await c.core.listPodForAllNamespaces();
  const columns: ResourceColumn[] = [
    { key: 'ready', label: 'Ready' },
    { key: 'status', label: 'Status', badge: true },
    { key: 'restarts', label: 'Restarts' },
    { key: 'node', label: 'Node' },
    AGE
  ];
  const rows = list.items.map((pod): ResourceRow => {
    const statuses = pod.status?.containerStatuses ?? [];
    const ready = statuses.filter((s) => s.ready).length;
    const total = pod.spec?.containers?.length ?? 0;
    const restarts = statuses.reduce((sum, s) => sum + (s.restartCount ?? 0), 0);

    // Surface the most informative status, the way kubectl does:
    // a waiting reason (CrashLoopBackOff, ImagePullBackOff…) beats the phase.
    let status = pod.status?.phase ?? 'Unknown';
    if (pod.metadata?.deletionTimestamp) {
      status = 'Terminating';
    } else {
      const waiting = statuses.find((s) => s.state?.waiting?.reason);
      if (waiting?.state?.waiting?.reason) status = waiting.state.waiting.reason;
    }

    let health: ResourceRow['health'] = 'warn';
    if (status === 'Running' && ready === total) health = 'ok';
    else if (status === 'Succeeded') health = 'ok';
    else if (/BackOff|Error|Failed|OOM/i.test(status)) health = 'err';

    return {
      ...baseRow(pod.metadata, true),
      cells: {
        ready: `${ready}/${total}`,
        status,
        restarts: String(restarts),
        node: pod.spec?.nodeName ?? '',
        age: formatAge(pod.metadata?.creationTimestamp)
      },
      health
    };
  });
  return { kind: 'pods', columns, rows };
}

async function listDeployments(c: Clients, namespace?: string): Promise<ResourceList> {
  const list = namespace
    ? await c.apps.listNamespacedDeployment({ namespace })
    : await c.apps.listDeploymentForAllNamespaces();
  const columns: ResourceColumn[] = [
    { key: 'ready', label: 'Ready', badge: true },
    { key: 'upToDate', label: 'Up-to-date' },
    { key: 'available', label: 'Available' },
    AGE
  ];
  const rows = list.items.map((d): ResourceRow => {
    const desired = d.spec?.replicas ?? 0;
    const ready = d.status?.readyReplicas ?? 0;
    return {
      ...baseRow(d.metadata, true),
      cells: {
        ready: `${ready}/${desired}`,
        upToDate: String(d.status?.updatedReplicas ?? 0),
        available: String(d.status?.availableReplicas ?? 0),
        age: formatAge(d.metadata?.creationTimestamp)
      },
      health: ready >= desired ? 'ok' : 'warn'
    };
  });
  return { kind: 'deployments', columns, rows };
}

async function listStatefulSets(c: Clients, namespace?: string): Promise<ResourceList> {
  const list = namespace
    ? await c.apps.listNamespacedStatefulSet({ namespace })
    : await c.apps.listStatefulSetForAllNamespaces();
  const columns: ResourceColumn[] = [{ key: 'ready', label: 'Ready', badge: true }, AGE];
  const rows = list.items.map((s): ResourceRow => {
    const desired = s.spec?.replicas ?? 0;
    const ready = s.status?.readyReplicas ?? 0;
    return {
      ...baseRow(s.metadata, true),
      cells: {
        ready: `${ready}/${desired}`,
        age: formatAge(s.metadata?.creationTimestamp)
      },
      health: ready >= desired ? 'ok' : 'warn'
    };
  });
  return { kind: 'statefulsets', columns, rows };
}

async function listDaemonSets(c: Clients, namespace?: string): Promise<ResourceList> {
  const list = namespace
    ? await c.apps.listNamespacedDaemonSet({ namespace })
    : await c.apps.listDaemonSetForAllNamespaces();
  const columns: ResourceColumn[] = [
    { key: 'desired', label: 'Desired' },
    { key: 'ready', label: 'Ready', badge: true },
    { key: 'available', label: 'Available' },
    AGE
  ];
  const rows = list.items.map((d): ResourceRow => {
    const desired = d.status?.desiredNumberScheduled ?? 0;
    const ready = d.status?.numberReady ?? 0;
    return {
      ...baseRow(d.metadata, true),
      cells: {
        desired: String(desired),
        ready: String(ready),
        available: String(d.status?.numberAvailable ?? 0),
        age: formatAge(d.metadata?.creationTimestamp)
      },
      health: ready >= desired ? 'ok' : 'warn'
    };
  });
  return { kind: 'daemonsets', columns, rows };
}

async function listReplicaSets(c: Clients, namespace?: string): Promise<ResourceList> {
  const list = namespace
    ? await c.apps.listNamespacedReplicaSet({ namespace })
    : await c.apps.listReplicaSetForAllNamespaces();
  const columns: ResourceColumn[] = [
    { key: 'desired', label: 'Desired' },
    { key: 'current', label: 'Current' },
    { key: 'ready', label: 'Ready' },
    AGE
  ];
  const rows = list.items.map((r): ResourceRow => {
    const desired = r.spec?.replicas ?? 0;
    const ready = r.status?.readyReplicas ?? 0;
    return {
      ...baseRow(r.metadata, true),
      cells: {
        desired: String(desired),
        current: String(r.status?.replicas ?? 0),
        ready: String(ready),
        age: formatAge(r.metadata?.creationTimestamp)
      },
      health: desired === 0 || ready >= desired ? 'ok' : 'warn'
    };
  });
  return { kind: 'replicasets', columns, rows };
}

async function listJobs(c: Clients, namespace?: string): Promise<ResourceList> {
  const list = namespace
    ? await c.batch.listNamespacedJob({ namespace })
    : await c.batch.listJobForAllNamespaces();
  const columns: ResourceColumn[] = [
    { key: 'completions', label: 'Completions' },
    { key: 'status', label: 'Status', badge: true },
    AGE
  ];
  const rows = list.items.map((j): ResourceRow => {
    const completions = j.spec?.completions ?? 1;
    const succeeded = j.status?.succeeded ?? 0;
    const failed = j.status?.failed ?? 0;
    const active = j.status?.active ?? 0;
    let status = 'Pending';
    let health: ResourceRow['health'] = 'warn';
    if (succeeded >= completions) {
      status = 'Complete';
      health = 'ok';
    } else if (active > 0) {
      status = 'Running';
    } else if (failed > 0) {
      status = 'Failed';
      health = 'err';
    }
    return {
      ...baseRow(j.metadata, true),
      cells: {
        completions: `${succeeded}/${completions}`,
        status,
        age: formatAge(j.metadata?.creationTimestamp)
      },
      health
    };
  });
  return { kind: 'jobs', columns, rows };
}

async function listCronJobs(c: Clients, namespace?: string): Promise<ResourceList> {
  const list = namespace
    ? await c.batch.listNamespacedCronJob({ namespace })
    : await c.batch.listCronJobForAllNamespaces();
  const columns: ResourceColumn[] = [
    { key: 'schedule', label: 'Schedule' },
    { key: 'suspend', label: 'Suspend' },
    { key: 'active', label: 'Active' },
    { key: 'lastSchedule', label: 'Last schedule' },
    AGE
  ];
  const rows = list.items.map(
    (cj): ResourceRow => ({
      ...baseRow(cj.metadata, true),
      cells: {
        schedule: cj.spec?.schedule ?? '',
        suspend: cj.spec?.suspend ? 'true' : 'false',
        active: String(cj.status?.active?.length ?? 0),
        lastSchedule: formatAge(cj.status?.lastScheduleTime),
        age: formatAge(cj.metadata?.creationTimestamp)
      },
      health: cj.spec?.suspend ? 'warn' : 'ok'
    })
  );
  return { kind: 'cronjobs', columns, rows };
}

async function listServices(c: Clients, namespace?: string): Promise<ResourceList> {
  const list = namespace
    ? await c.core.listNamespacedService({ namespace })
    : await c.core.listServiceForAllNamespaces();
  const columns: ResourceColumn[] = [
    { key: 'type', label: 'Type' },
    { key: 'clusterIP', label: 'Cluster IP' },
    { key: 'ports', label: 'Ports' },
    AGE
  ];
  const rows = list.items.map(
    (s): ResourceRow => ({
      ...baseRow(s.metadata, true),
      cells: {
        type: s.spec?.type ?? '',
        clusterIP: s.spec?.clusterIP ?? '',
        ports: (s.spec?.ports ?? [])
          .map((p) => `${p.port}${p.nodePort ? `:${p.nodePort}` : ''}/${p.protocol ?? 'TCP'}`)
          .join(', '),
        age: formatAge(s.metadata?.creationTimestamp)
      },
      health: 'none'
    })
  );
  return { kind: 'services', columns, rows };
}

async function listIngresses(c: Clients, namespace?: string): Promise<ResourceList> {
  const list = namespace
    ? await c.networking.listNamespacedIngress({ namespace })
    : await c.networking.listIngressForAllNamespaces();
  const columns: ResourceColumn[] = [
    { key: 'class', label: 'Class' },
    { key: 'hosts', label: 'Hosts' },
    AGE
  ];
  const rows = list.items.map(
    (i): ResourceRow => ({
      ...baseRow(i.metadata, true),
      cells: {
        class: i.spec?.ingressClassName ?? '',
        hosts: (i.spec?.rules ?? []).map((r) => r.host ?? '*').join(', '),
        age: formatAge(i.metadata?.creationTimestamp)
      },
      health: 'none'
    })
  );
  return { kind: 'ingresses', columns, rows };
}

async function listConfigMaps(c: Clients, namespace?: string): Promise<ResourceList> {
  const list = namespace
    ? await c.core.listNamespacedConfigMap({ namespace })
    : await c.core.listConfigMapForAllNamespaces();
  const columns: ResourceColumn[] = [{ key: 'keys', label: 'Keys' }, AGE];
  const rows = list.items.map(
    (cm): ResourceRow => ({
      ...baseRow(cm.metadata, true),
      cells: {
        keys: String(Object.keys(cm.data ?? {}).length + Object.keys(cm.binaryData ?? {}).length),
        age: formatAge(cm.metadata?.creationTimestamp)
      },
      health: 'none'
    })
  );
  return { kind: 'configmaps', columns, rows };
}

async function listSecrets(c: Clients, namespace?: string): Promise<ResourceList> {
  const list = namespace
    ? await c.core.listNamespacedSecret({ namespace })
    : await c.core.listSecretForAllNamespaces();
  const columns: ResourceColumn[] = [
    { key: 'type', label: 'Type' },
    { key: 'keys', label: 'Keys' },
    AGE
  ];
  // Secret values intentionally never leave the main process; only metadata is listed.
  const rows = list.items.map(
    (s): ResourceRow => ({
      ...baseRow(s.metadata, true),
      cells: {
        type: s.type ?? '',
        keys: String(Object.keys(s.data ?? {}).length),
        age: formatAge(s.metadata?.creationTimestamp)
      },
      health: 'none'
    })
  );
  return { kind: 'secrets', columns, rows };
}

async function listPvcs(c: Clients, namespace?: string): Promise<ResourceList> {
  const list = namespace
    ? await c.core.listNamespacedPersistentVolumeClaim({ namespace })
    : await c.core.listPersistentVolumeClaimForAllNamespaces();
  const columns: ResourceColumn[] = [
    { key: 'status', label: 'Status', badge: true },
    { key: 'volume', label: 'Volume' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'storageClass', label: 'Storage class' },
    AGE
  ];
  const rows = list.items.map((p): ResourceRow => {
    const status = p.status?.phase ?? 'Unknown';
    return {
      ...baseRow(p.metadata, true),
      cells: {
        status,
        volume: p.spec?.volumeName ?? '',
        capacity: p.status?.capacity?.storage ?? '',
        storageClass: p.spec?.storageClassName ?? '',
        age: formatAge(p.metadata?.creationTimestamp)
      },
      health: status === 'Bound' ? 'ok' : status === 'Pending' ? 'warn' : 'err'
    };
  });
  return { kind: 'persistentvolumeclaims', columns, rows };
}

async function listNodes(c: Clients): Promise<ResourceList> {
  const list = await c.core.listNode();
  const columns: ResourceColumn[] = [
    { key: 'status', label: 'Status', badge: true },
    { key: 'roles', label: 'Roles' },
    { key: 'version', label: 'Version' },
    { key: 'os', label: 'OS / Arch' },
    AGE
  ];
  const rows = list.items.map((n): ResourceRow => {
    const ready = n.status?.conditions?.some((cond) => cond.type === 'Ready' && cond.status === 'True');
    const roles = Object.keys(n.metadata?.labels ?? {})
      .filter((l) => l.startsWith('node-role.kubernetes.io/'))
      .map((l) => l.replace('node-role.kubernetes.io/', ''))
      .join(', ');
    return {
      ...baseRow(n.metadata, false),
      cells: {
        status: ready ? 'Ready' : 'NotReady',
        roles: roles || '<none>',
        version: n.status?.nodeInfo?.kubeletVersion ?? '',
        os: `${n.status?.nodeInfo?.operatingSystem ?? ''}/${n.status?.nodeInfo?.architecture ?? ''}`,
        age: formatAge(n.metadata?.creationTimestamp)
      },
      health: ready ? 'ok' : 'err'
    };
  });
  return { kind: 'nodes', columns, rows };
}

async function listNamespacesAsResources(c: Clients): Promise<ResourceList> {
  const list = await c.core.listNamespace();
  const columns: ResourceColumn[] = [{ key: 'status', label: 'Status', badge: true }, AGE];
  const rows = list.items.map((ns): ResourceRow => {
    const status = ns.status?.phase ?? 'Unknown';
    return {
      ...baseRow(ns.metadata, false),
      cells: { status, age: formatAge(ns.metadata?.creationTimestamp) },
      health: status === 'Active' ? 'ok' : 'warn'
    };
  });
  return { kind: 'namespaces', columns, rows };
}

async function listEvents(c: Clients, namespace?: string): Promise<ResourceList> {
  const list = namespace
    ? await c.core.listNamespacedEvent({ namespace })
    : await c.core.listEventForAllNamespaces();
  const columns: ResourceColumn[] = [
    { key: 'type', label: 'Type', badge: true },
    { key: 'reason', label: 'Reason' },
    { key: 'object', label: 'Object' },
    { key: 'message', label: 'Message' },
    { key: 'lastSeen', label: 'Last seen' }
  ];
  const sorted = [...list.items].sort((a, b) => {
    const ta = new Date(a.lastTimestamp ?? a.metadata?.creationTimestamp ?? 0).getTime();
    const tb = new Date(b.lastTimestamp ?? b.metadata?.creationTimestamp ?? 0).getTime();
    return tb - ta;
  });
  const rows = sorted.map(
    (e): ResourceRow => ({
      ...baseRow(e.metadata, true),
      cells: {
        type: e.type ?? '',
        reason: e.reason ?? '',
        object: `${e.involvedObject?.kind ?? ''}/${e.involvedObject?.name ?? ''}`,
        message: e.message ?? '',
        lastSeen: formatAge(e.lastTimestamp ?? e.metadata?.creationTimestamp)
      },
      health: e.type === 'Warning' ? 'warn' : 'none'
    })
  );
  return { kind: 'events', columns, rows };
}

export async function buildResourceList(
  kind: ResourceKind,
  namespace: string | undefined,
  clients: Clients
): Promise<ResourceList> {
  const ns = namespace || undefined;
  switch (kind) {
    case 'pods':
      return listPods(clients, ns);
    case 'deployments':
      return listDeployments(clients, ns);
    case 'statefulsets':
      return listStatefulSets(clients, ns);
    case 'daemonsets':
      return listDaemonSets(clients, ns);
    case 'replicasets':
      return listReplicaSets(clients, ns);
    case 'jobs':
      return listJobs(clients, ns);
    case 'cronjobs':
      return listCronJobs(clients, ns);
    case 'services':
      return listServices(clients, ns);
    case 'ingresses':
      return listIngresses(clients, ns);
    case 'configmaps':
      return listConfigMaps(clients, ns);
    case 'secrets':
      return listSecrets(clients, ns);
    case 'persistentvolumeclaims':
      return listPvcs(clients, ns);
    case 'nodes':
      return listNodes(clients);
    case 'namespaces':
      return listNamespacesAsResources(clients);
    case 'events':
      return listEvents(clients, ns);
  }
}
