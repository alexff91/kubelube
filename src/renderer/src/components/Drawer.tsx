import { useCallback, useEffect, useState } from 'react';
import type { PodDetail, ResourceKind } from '@shared/types';
import { kube, unwrap } from '../api';
import { Icon } from './Icon';

export interface Selection {
  kind: ResourceKind;
  name: string;
  namespace?: string;
}

type Tab = 'details' | 'yaml' | 'logs';

interface Props {
  selection: Selection;
  onClose: () => void;
  /** Called after a mutation (delete/scale) so lists can refresh. */
  onChanged: () => void;
  notify: (message: string, isError?: boolean) => void;
}

const SCALABLE = new Set<ResourceKind>(['deployments', 'statefulsets']);

export function Drawer({ selection, onClose, onChanged, notify }: Props) {
  const isPod = selection.kind === 'pods';
  const [tab, setTab] = useState<Tab>(isPod ? 'details' : 'yaml');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDelete = async () => {
    const target = selection.namespace
      ? `${selection.namespace}/${selection.name}`
      : selection.name;
    if (!window.confirm(`Delete ${selection.kind.replace(/s$/, '')} "${target}"?`)) return;
    setDeleting(true);
    try {
      await unwrap(kube.deleteResource(selection.kind, selection.name, selection.namespace));
      notify(`Deleted ${target}`);
      onChanged();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), true);
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label={selection.name}>
        <div className="drawer-header">
          <div className="titles">
            <h2>{selection.name}</h2>
            <div className="subtitle">
              {selection.kind}
              {selection.namespace ? ` · ${selection.namespace}` : ''}
            </div>
          </div>
          <button className="btn icon-only" onClick={onClose} title="Close (Esc)">
            <Icon name="x" />
          </button>
        </div>

        <div className="tabs">
          {isPod && (
            <button
              className={`tab${tab === 'details' ? ' active' : ''}`}
              onClick={() => setTab('details')}
            >
              Details
            </button>
          )}
          <button
            className={`tab${tab === 'yaml' ? ' active' : ''}`}
            onClick={() => setTab('yaml')}
          >
            YAML
          </button>
          {isPod && (
            <button
              className={`tab${tab === 'logs' ? ' active' : ''}`}
              onClick={() => setTab('logs')}
            >
              Logs
            </button>
          )}
        </div>

        <div className="drawer-body">
          {tab === 'details' && isPod && <PodDetails selection={selection} />}
          {tab === 'yaml' && <YamlView selection={selection} notify={notify} />}
          {tab === 'logs' && isPod && <LogsView selection={selection} />}
        </div>

        <div className="drawer-actions">
          {SCALABLE.has(selection.kind) && selection.namespace && (
            <ScaleControl selection={selection} onChanged={onChanged} notify={notify} />
          )}
          <div style={{ flex: 1 }} />
          <button className="btn danger" onClick={() => void handleDelete()} disabled={deleting}>
            <Icon name="trash" /> {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </>
  );
}

function PodDetails({ selection }: { selection: Selection }) {
  const [detail, setDetail] = useState<PodDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void unwrap(kube.getPodDetail(selection.namespace ?? '', selection.name))
      .then((d) => !cancelled && setDetail(d))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [selection]);

  if (error) return <p style={{ color: 'var(--err)' }}>{error}</p>;
  if (!detail) return <div className="spinner" />;

  return (
    <>
      <dl className="kv-grid">
        <dt>Phase</dt>
        <dd>{detail.phase}</dd>
        <dt>Node</dt>
        <dd>{detail.nodeName ?? '—'}</dd>
        <dt>Pod IP</dt>
        <dd>{detail.podIP ?? '—'}</dd>
        <dt>Namespace</dt>
        <dd>{detail.namespace}</dd>
      </dl>
      <div className="section-title" style={{ marginTop: 0 }}>
        Containers
      </div>
      {detail.containers.map((container) => (
        <div className="container-card" key={container.name}>
          <span className={`dot ${container.ready ? 'ok' : 'err'}`} />
          <span className="c-name">{container.name}</span>
          <span className="c-image" title={container.image}>
            {container.image}
          </span>
          <span className="badge">{container.state}</span>
          <span title="Restarts">↻ {container.restartCount}</span>
        </div>
      ))}
    </>
  );
}

function YamlView({
  selection,
  notify
}: {
  selection: Selection;
  notify: (message: string, isError?: boolean) => void;
}) {
  const [yaml, setYaml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setYaml(null);
    void unwrap(kube.getResourceYaml(selection.kind, selection.name, selection.namespace))
      .then((y) => !cancelled && setYaml(y))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [selection]);

  if (error) return <p style={{ color: 'var(--err)' }}>{error}</p>;
  if (yaml === null) return <div className="spinner" />;

  return (
    <>
      <div className="toolbar">
        <button
          className="btn"
          onClick={() => {
            void navigator.clipboard.writeText(yaml);
            notify('YAML copied to clipboard');
          }}
        >
          <Icon name="copy" /> Copy
        </button>
      </div>
      <pre className="code">{yaml}</pre>
    </>
  );
}

const TAIL_OPTIONS = [100, 500, 1000, 5000];

function LogsView({ selection }: { selection: Selection }) {
  const [detail, setDetail] = useState<PodDetail | null>(null);
  const [container, setContainer] = useState<string>('');
  const [tailLines, setTailLines] = useState(500);
  const [previous, setPrevious] = useState(false);
  const [logs, setLogs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void unwrap(kube.getPodDetail(selection.namespace ?? '', selection.name))
      .then((d) => {
        if (!cancelled) {
          setDetail(d);
          setContainer((prev) => prev || (d.containers[0]?.name ?? ''));
        }
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, [selection]);

  const load = useCallback(async () => {
    if (!container) return;
    setLoading(true);
    setError(null);
    try {
      const text = await unwrap(
        kube.getPodLogs({
          namespace: selection.namespace ?? '',
          pod: selection.name,
          container,
          tailLines,
          previous
        })
      );
      setLogs(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selection, container, tailLines, previous]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <div className="toolbar">
        {detail && detail.containers.length > 1 && (
          <select
            className="select"
            value={container}
            onChange={(e) => setContainer(e.target.value)}
          >
            {detail.containers.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <select
          className="select"
          value={tailLines}
          onChange={(e) => setTailLines(Number(e.target.value))}
        >
          {TAIL_OPTIONS.map((n) => (
            <option key={n} value={n}>
              last {n} lines
            </option>
          ))}
        </select>
        <label className="label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox"
            checked={previous}
            onChange={(e) => setPrevious(e.target.checked)}
          />
          previous
        </label>
        <button className="btn" onClick={() => void load()} disabled={loading}>
          <Icon name="refresh" /> {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {error ? (
        <p style={{ color: 'var(--err)' }}>{error}</p>
      ) : logs === null ? (
        <div className="spinner" />
      ) : (
        <pre className="code logs">{logs || '(no log output)'}</pre>
      )}
    </>
  );
}

function ScaleControl({
  selection,
  onChanged,
  notify
}: {
  selection: Selection;
  onChanged: () => void;
  notify: (message: string, isError?: boolean) => void;
}) {
  const [replicas, setReplicas] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    const count = Number(replicas);
    if (!Number.isInteger(count) || count < 0) {
      notify('Replicas must be a non-negative integer', true);
      return;
    }
    setBusy(true);
    try {
      await unwrap(
        kube.scaleWorkload(
          selection.kind as 'deployments' | 'statefulsets',
          selection.namespace ?? '',
          selection.name,
          count
        )
      );
      notify(`Scaled ${selection.name} to ${count} replicas`);
      onChanged();
    } catch (err) {
      notify(err instanceof Error ? err.message : String(err), true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <span className="label">Scale to</span>
      <input
        className="scale-input"
        type="number"
        min={0}
        placeholder="n"
        value={replicas}
        onChange={(e) => setReplicas(e.target.value)}
      />
      <button className="btn" onClick={() => void apply()} disabled={busy || replicas === ''}>
        {busy ? 'Scaling…' : 'Apply'}
      </button>
    </>
  );
}
