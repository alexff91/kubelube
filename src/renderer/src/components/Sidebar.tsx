import type { ConnectionStatus, KubeContextInfo } from '@shared/types';
import { NAV_GROUPS, type ViewId } from '../nav';
import { Icon } from './Icon';

interface Props {
  contexts: KubeContextInfo[];
  status: ConnectionStatus | null;
  connecting: boolean;
  view: ViewId;
  onSelectView: (view: ViewId) => void;
  onSwitchContext: (name: string) => void;
  onReload: () => void;
}

export function Sidebar({
  contexts,
  status,
  connecting,
  view,
  onSelectView,
  onSwitchContext,
  onReload
}: Props) {
  const current = contexts.find((c) => c.isCurrent)?.name ?? '';
  const dotClass = connecting ? 'busy' : status?.connected ? 'ok' : 'err';
  const statusText = connecting
    ? 'Connecting…'
    : status?.connected
      ? (status.clusterVersion ?? 'Connected')
      : (status?.error ?? 'Disconnected');

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">
          <Icon name="helm" size={19} />
        </div>
        <div className="brand-name">Kubelube</div>
      </div>

      <div className="context-box">
        <div className="context-label">
          Context
          <button
            className="btn icon-only"
            style={{ padding: 3, border: 'none', background: 'none' }}
            onClick={onReload}
            title="Reload kubeconfig"
          >
            <Icon name="refresh" size={13} />
          </button>
        </div>
        <select
          className="context-select"
          value={current}
          disabled={connecting || contexts.length === 0}
          onChange={(e) => onSwitchContext(e.target.value)}
        >
          {contexts.length === 0 && <option value="">No contexts found</option>}
          {contexts.map((ctx) => (
            <option key={ctx.name} value={ctx.name}>
              {ctx.name}
            </option>
          ))}
        </select>
        <div className="context-status" title={statusText}>
          <div className={`dot ${dotClass}`} />
          <span>{statusText}</span>
        </div>
      </div>

      <nav className="nav">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.title ?? i}>
            {group.title && <div className="nav-group-title">{group.title}</div>}
            {group.items.map((item) => (
              <button
                key={item.id}
                className={`nav-item${view === item.id ? ' active' : ''}`}
                onClick={() => onSelectView(item.id)}
              >
                <Icon name={item.icon} />
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
