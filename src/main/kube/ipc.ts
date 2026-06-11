import { ipcMain } from 'electron';
import type { ApiResult, LogOptions, ResourceKind } from '@shared/types';
import { IPC } from '@shared/types';
import { errorMessage, KubeService } from './service';

/**
 * Wraps a handler so every IPC call resolves to an ApiResult instead of
 * rejecting: connection problems become data the UI can render, not
 * uncaught exceptions in the renderer console.
 */
function handle<TArgs extends unknown[], TData>(
  channel: string,
  fn: (...args: TArgs) => Promise<TData> | TData
): void {
  ipcMain.handle(channel, async (_event, ...args: unknown[]): Promise<ApiResult<TData>> => {
    try {
      const data = await fn(...(args as TArgs));
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: { message: errorMessage(err) } };
    }
  });
}

export function registerKubeIpc(): void {
  const service = new KubeService();

  handle(IPC.listContexts, () => service.listContexts());
  handle(IPC.useContext, (name: string) => service.useContext(name));
  handle(IPC.reloadKubeconfig, () => {
    service.reload();
    return service.listContexts();
  });
  handle(IPC.getConnectionStatus, () => service.getConnectionStatus());
  handle(IPC.listNamespaces, () => service.listNamespaces());
  handle(IPC.listResources, (kind: ResourceKind, namespace?: string) =>
    service.listResources(kind, namespace)
  );
  handle(IPC.getResourceYaml, (kind: ResourceKind, name: string, namespace?: string) =>
    service.getResourceYaml(kind, name, namespace)
  );
  handle(IPC.deleteResource, (kind: ResourceKind, name: string, namespace?: string) =>
    service.deleteResource(kind, name, namespace)
  );
  handle(IPC.getPodDetail, (namespace: string, name: string) =>
    service.getPodDetail(namespace, name)
  );
  handle(IPC.getPodLogs, (opts: LogOptions) => service.getPodLogs(opts));
  handle(IPC.getOverview, () => service.getOverview());
  handle(
    IPC.scaleWorkload,
    (kind: 'deployments' | 'statefulsets', namespace: string, name: string, replicas: number) =>
      service.scaleWorkload(kind, namespace, name, replicas)
  );
}
