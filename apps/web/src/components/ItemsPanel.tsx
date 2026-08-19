import { useItems } from '../hooks/useApi.js';
import { ItemSummary } from '@ai-inbox/contracts';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: ItemSummary['status'] }) {
  const map = {
    ready: { cls: 'status-ready', icon: '●', label: 'Ready' },
    processing: { cls: 'status-processing', icon: '◌', label: 'Indexing…' },
    failed: { cls: 'status-failed', icon: '✕', label: 'Failed' },
  };
  const { cls, icon, label } = map[status];
  return (
    <span className={`item-status ${cls}`} aria-label={`Status: ${label}`}>
      {icon} {label}
    </span>
  );
}

function ItemCard({ item }: { item: ItemSummary }) {
  return (
    <article className="item-card animate-in">
      <div className="item-card-header">
        <span className={`item-type-badge ${item.sourceType === 'note' ? 'badge-note' : 'badge-url'}`}>
          {item.sourceType === 'note' ? '📝 Note' : '🔗 URL'}
        </span>
        <div className="item-title">{item.title}</div>
        <StatusBadge status={item.status} />
      </div>

      {item.preview && (
        <p className="item-preview">{item.preview}</p>
      )}

      {item.errorMessage && (
        <div className="item-error" role="alert">
          ⚠️ {item.errorMessage}
        </div>
      )}

      <div className="item-meta">
        <span>{formatDate(item.createdAt)}</span>
        {item.status === 'ready' && item.chunkCount > 0 && (
          <span className="chunk-badge">{item.chunkCount} chunks</span>
        )}
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="item-url-link"
            title={item.sourceUrl}
          >
            ↗ {new URL(item.sourceUrl).hostname}
          </a>
        )}
      </div>
    </article>
  );
}

export function ItemsPanel() {
  const { data, isLoading, error, refetch } = useItems();

  return (
    <div className="panel" style={{ marginTop: '20px' }}>
      <div className="panel-header">
        <div className="panel-icon">📚</div>
        <span className="panel-title">Saved Knowledge</span>
        {data && (
          <span className="chunk-badge" style={{ marginLeft: 'auto' }}>
            {data.items.length} item{data.items.length !== 1 ? 's' : ''}
          </span>
        )}
        <button
          onClick={() => refetch()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', marginLeft: data ? '0' : 'auto', padding: '4px' }}
          title="Refresh list"
          aria-label="Refresh saved items"
        >
          ↻
        </button>
      </div>
      <div className="panel-body">
        {isLoading && (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto 12px', width: '24px', height: '24px' }} aria-label="Loading" />
            <p>Loading saved items…</p>
          </div>
        )}

        {error && (
          <div className="alert alert-error" role="alert">
            <span>⚠️</span>
            <span>Failed to load items. <button onClick={() => refetch()} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button></span>
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <h3>No saved items yet</h3>
            <p>Add notes or URLs above to build your knowledge base.</p>
          </div>
        )}

        {data && data.items.length > 0 && (
          <div className="items-list" role="list" aria-label="Saved knowledge items">
            {data.items.map((item) => (
              <div key={item.id} role="listitem">
                <ItemCard item={item} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
