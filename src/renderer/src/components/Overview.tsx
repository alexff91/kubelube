import { useEffect, useState } from 'react';
import type { ClusterOverview } from '@shared/types';
import { kube, unwrap } from '../api';
import type { ViewId } from '../nav';
import { Icon } from './Icon';

const POLL_INTERVAL_MS = 15000;

interface Props {
  refreshTick: number;
  onNavigate: (view: ViewId) => void;
}

export function Overview({ refreshTick, onNavigate }: Props) {
  const [data, setData] = useState<ClusterOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);

    const load = async () => {
      try {
        const overview = await unwrap(kube.getOverview());
        if (!cancelled) {
          setData(overview);
          setError(null);
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
  }, [refreshTick]);

  if (error) {
    return (
      <div className="state-screen">
        <div className="big-icon">
          <Icon name="alert" size={26} />
        </div>
        <h2>Failed to load overview</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="state-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="cards">
        <Card
          label="Cluster"
          value={data.contextName}
          sub={data.clusterVersion}
          small
          onClick={() => onNavigate('overview')}
        />
        <Card
          label="Nodes"
          value={`${data.nodes.ready}/${data.nodes.total}`}
          sub="ready"
          onClick={() => onNavigate('nodes')}
        />
        <Card
          label="Namespaces"
          value={String(data.namespaces)}
          sub="total"
          onClick={() => onNavigate('namespaces')}
        />
        <Card
          label="Pods"
          value={`${data.pods.running}/${data.pods.total}`}
          sub={podsSubtitle(data.pods)}
          onClick={() => onNavigate('pods')}
        />
        <Card
          label="Deployments"
          value={`${data.deployments.ready}/${data.deployments.total}`}
          sub="ready"
          onClick={() => onNavigate('deployments')}
        />
      </div>

      <div className="section-title">Recent warnings</div>
      <div className="panel">
        {data.warningEvents.length === 0 ? (
          <div className="state-screen" style={{ padding: '34px 24px' }}>
            <h2>All quiet</h2>
            <p>No warning events in the cluster.</p>
          </div>
        ) : (
          <div className="event-list">
            {data.warningEvents.map((event, i) => (
              <div className="event-row" key={i}>
                <span className="reason">{event.reason}</span>
                <span className="object" title={event.object}>
                  {event.object}
                </span>
                <span title={event.message}>{event.message}</span>
                <span>{event.lastSeen ? timeAgo(event.lastSeen) : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Card({
  label,
  value,
  sub,
  small,
  onClick
}: {
  label: string;
  value: string;
  sub?: string;
  small?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <div className="card-label">{label}</div>
      <div
        className="card-value"
        style={small ? { fontSize: 18, wordBreak: 'break-all' } : undefined}
      >
        {value}
      </div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  );
}

function podsSubtitle(pods: ClusterOverview['pods']): string {
  const parts: string[] = [];
  if (pods.pending > 0) parts.push(`${pods.pending} pending`);
  if (pods.failed > 0) parts.push(`${pods.failed} failed`);
  return parts.length > 0 ? parts.join(', ') : 'running';
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
