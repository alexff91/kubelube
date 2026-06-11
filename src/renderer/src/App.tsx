import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectionStatus, KubeContextInfo, ResourceKind } from '@shared/types';
import { kube, unwrap } from './api';
import { CLUSTER_SCOPED, viewLabel, type ViewId } from './nav';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Overview } from './components/Overview';
import { ResourceTable } from './components/ResourceTable';
import { Drawer, type Selection } from './components/Drawer';
import { Icon } from './components/Icon';

interface Toast {
  message: string;
  isError: boolean;
}

export function App() {
  const [contexts, setContexts] = useState<KubeContextInfo[]>([]);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [view, setView] = useState<ViewId>('overview');
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [namespace, setNamespace] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Selection | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const notify = useCallback((message: string, isError = false) => {
    clearTimeout(toastTimer.current);
    setToast({ message, isError });
    toastTimer.current = setTimeout(() => setToast(null), isError ? 6000 : 3000);
  }, []);

  const refreshNamespaces = useCallback(async () => {
    try {
      setNamespaces(await unwrap(kube.listNamespaces()));
    } catch {
      setNamespaces([]);
    }
  }, []);

  const connect = useCallback(
    async (run: () => Promise<ConnectionStatus>) => {
      setConnecting(true);
      try {
        const next = await run();
        setStatus(next);
        if (next.connected) {
          await refreshNamespaces();
        }
      } catch (err) {
        setStatus({ connected: false, error: err instanceof Error ? err.message : String(err) });
      } finally {
        setConnecting(false);
      }
    },
    [refreshNamespaces]
  );

  useEffect(() => {
    void (async () => {
      try {
        setContexts(await unwrap(kube.listContexts()));
      } catch (err) {
        notify(err instanceof Error ? err.message : String(err), true);
      }
      await connect(() => unwrap(kube.getConnectionStatus()));
    })();
  }, [connect, notify]);

  const switchContext = useCallback(
    async (name: string) => {
      setSelected(null);
      setNamespace('');
      setContexts((prev) => prev.map((c) => ({ ...c, isCurrent: c.name === name })));
      await connect(() => unwrap(kube.useContext(name)));
    },
    [connect]
  );

  const reloadKubeconfig = useCallback(async () => {
    try {
      setContexts(await unwrap(kube.reloadKubeconfig()));
      await connect(() => unwrap(kube.getConnectionStatus()));
      notify('Kubeconfig reloaded');
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), true);
    }
  }, [connect, notify]);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);

  const openResource = useCallback((kind: ResourceKind, name: string, ns?: string) => {
    setSelected({ kind, name, namespace: ns });
  }, []);

  const showNamespaceFilter = !CLUSTER_SCOPED.has(view);
  const connected = status?.connected ?? false;

  return (
    <div className="app">
      <Sidebar
        contexts={contexts}
        status={status}
        connecting={connecting}
        view={view}
        onSelectView={(v) => {
          setView(v);
          setSearch('');
        }}
        onSwitchContext={(name) => void switchContext(name)}
        onReload={() => void reloadKubeconfig()}
      />
      <div className="main">
        <TopBar
          title={viewLabel(view)}
          namespaces={namespaces}
          namespace={showNamespaceFilter ? namespace : undefined}
          onNamespace={setNamespace}
          search={search}
          onSearch={setSearch}
          onRefresh={refresh}
          showSearch={view !== 'overview'}
        />
        <div className="content">
          {!connected ? (
            <DisconnectedScreen
              status={status}
              connecting={connecting}
              onRetry={() => void connect(() => unwrap(kube.getConnectionStatus()))}
            />
          ) : view === 'overview' ? (
            <Overview refreshTick={refreshTick} onNavigate={setView} />
          ) : (
            <ResourceTable
              kind={view}
              namespace={showNamespaceFilter ? namespace : undefined}
              search={search}
              refreshTick={refreshTick}
              onSelect={openResource}
            />
          )}
        </div>
      </div>
      {selected && (
        <Drawer
          selection={selected}
          onClose={() => setSelected(null)}
          onChanged={refresh}
          notify={notify}
        />
      )}
      {toast && <div className={`toast${toast.isError ? ' err' : ''}`}>{toast.message}</div>}
    </div>
  );
}

function DisconnectedScreen({
  status,
  connecting,
  onRetry
}: {
  status: ConnectionStatus | null;
  connecting: boolean;
  onRetry: () => void;
}) {
  if (connecting || status === null) {
    return (
      <div className="state-screen">
        <div className="spinner" />
        <h2>Connecting to cluster…</h2>
      </div>
    );
  }
  return (
    <div className="state-screen">
      <div className="big-icon">
        <Icon name="cloudOff" size={26} />
      </div>
      <h2>Not connected</h2>
      <p>
        {status.error ??
          'Select a context in the sidebar, or check that your kubeconfig is reachable.'}
      </p>
      <button className="btn primary" onClick={onRetry}>
        <Icon name="refresh" /> Retry
      </button>
    </div>
  );
}
