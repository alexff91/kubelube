import { useEffect, useState } from 'react';
import type { ResourceKind, ResourceList } from '@shared/types';
import { kube, unwrap } from '../api';
import { Icon } from './Icon';

const POLL_INTERVAL_MS = 8000;

interface Props {
  kind: ResourceKind;
  namespace?: string;
  search: string;
  refreshTick: number;
  onSelect: (kind: ResourceKind, name: string, namespace?: string) => void;
}

export function ResourceTable({ kind, namespace, search, refreshTick, onSelect }: Props) {
  const [list, setList] = useState<ResourceList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    setList(null);
    setError(null);

    const load = async () => {
      try {
        const data = await unwrap(kube.listResources(kind, namespace));
        if (!cancelled) {
          setList(data);
          setError(null);
          setUpdatedAt(new Date());
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    };

    void load();
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [kind, namespace, refreshTick]);

  if (error) {
    return (
      <div className="state-screen">
        <div className="big-icon">
          <Icon name="alert" size={26} />
        </div>
        <h2>Failed to load {kind}</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="state-screen">
        <div className="spinner" />
      </div>
    );
  }

  const query = search.trim().toLowerCase();
  const rows = query
    ? list.rows.filter(
        (r) => r.name.toLowerCase().includes(query) || r.namespace?.toLowerCase().includes(query)
      )
    : list.rows;

  if (rows.length === 0) {
    return (
      <div className="state-screen">
        <div className="big-icon">
          <Icon name="box" size={26} />
        </div>
        <h2>No {kind} found</h2>
        <p>{query ? 'Nothing matches the current filter.' : 'This view is empty right now.'}</p>
      </div>
    );
  }

  const hasNamespace = rows.some((r) => r.namespace !== undefined);

  return (
    <div className="panel">
      <div className="table-wrap">
        <table className="resources">
          <thead>
            <tr>
              <th>Name</th>
              {hasNamespace && <th>Namespace</th>}
              {list.columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.uid}
                className={`health-${row.health}`}
                onClick={() => onSelect(kind, row.name, row.namespace)}
              >
                <td className="cell-name" title={row.name}>
                  {row.name}
                </td>
                {hasNamespace && <td>{row.namespace}</td>}
                {list.columns.map((col) => {
                  const value = row.cells[col.key] ?? '';
                  return (
                    <td key={col.key} title={value}>
                      {col.badge ? (
                        <span className={`badge ${badgeClass(row.health, value)}`}>{value}</span>
                      ) : (
                        value
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-meta">
        <span>
          {rows.length} of {list.rows.length} items
        </span>
        {updatedAt && <span>· updated {updatedAt.toLocaleTimeString()}</span>}
        <span>· auto-refresh {POLL_INTERVAL_MS / 1000}s</span>
      </div>
    </div>
  );
}

function badgeClass(health: string, value: string): string {
  if (health === 'ok') return 'ok';
  if (health === 'err') return 'err';
  if (health === 'warn') return 'warn';
  // health 'none': still color obviously good/bad words (e.g. event types)
  if (/^(Normal|Active|Bound|Ready|Complete)$/.test(value)) return 'ok';
  if (/^Warning$/.test(value)) return 'warn';
  return '';
}
