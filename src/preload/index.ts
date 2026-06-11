import { contextBridge, ipcRenderer } from 'electron';
import type { KubelubeApi } from '@shared/api';
import { IPC } from '@shared/types';

const api: KubelubeApi = {
  listContexts: () => ipcRenderer.invoke(IPC.listContexts),
  useContext: (name) => ipcRenderer.invoke(IPC.useContext, name),
  reloadKubeconfig: () => ipcRenderer.invoke(IPC.reloadKubeconfig),
  getConnectionStatus: () => ipcRenderer.invoke(IPC.getConnectionStatus),
  listNamespaces: () => ipcRenderer.invoke(IPC.listNamespaces),
  listResources: (kind, namespace) => ipcRenderer.invoke(IPC.listResources, kind, namespace),
  getResourceYaml: (kind, name, namespace) =>
    ipcRenderer.invoke(IPC.getResourceYaml, kind, name, namespace),
  deleteResource: (kind, name, namespace) =>
    ipcRenderer.invoke(IPC.deleteResource, kind, name, namespace),
  getPodDetail: (namespace, name) => ipcRenderer.invoke(IPC.getPodDetail, namespace, name),
  getPodLogs: (opts) => ipcRenderer.invoke(IPC.getPodLogs, opts),
  getOverview: () => ipcRenderer.invoke(IPC.getOverview),
  scaleWorkload: (kind, namespace, name, replicas) =>
    ipcRenderer.invoke(IPC.scaleWorkload, kind, namespace, name, replicas)
};

contextBridge.exposeInMainWorld('kubelube', api);
