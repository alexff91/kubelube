import { Icon } from './Icon';

interface Props {
  title: string;
  namespaces: string[];
  /** undefined hides the namespace filter (cluster-scoped views). */
  namespace?: string;
  onNamespace: (ns: string) => void;
  search: string;
  onSearch: (q: string) => void;
  onRefresh: () => void;
  showSearch: boolean;
}

export function TopBar({
  title,
  namespaces,
  namespace,
  onNamespace,
  search,
  onSearch,
  onRefresh,
  showSearch
}: Props) {
  return (
    <header className="topbar">
      <h1>{title}</h1>
      <div className="spacer" />
      {namespace !== undefined && (
        <select
          className="select"
          value={namespace}
          onChange={(e) => onNamespace(e.target.value)}
          title="Namespace filter"
        >
          <option value="">All namespaces</option>
          {namespaces.map((ns) => (
            <option key={ns} value={ns}>
              {ns}
            </option>
          ))}
        </select>
      )}
      {showSearch && (
        <div className="search">
          <Icon name="search" size={14} />
          <input
            placeholder="Filter by name…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            spellCheck={false}
          />
        </div>
      )}
      <button className="btn icon-only" onClick={onRefresh} title="Refresh">
        <Icon name="refresh" />
      </button>
    </header>
  );
}
