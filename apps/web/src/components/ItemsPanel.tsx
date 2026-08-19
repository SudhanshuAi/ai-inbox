import { useState, useEffect } from 'react';
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

function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-line w-1-2" style={{ marginBottom: '8px' }} />
      <div className="skeleton-line w-3-4" />
      <div className="skeleton-line w-1-3" style={{ marginTop: '10px' }} />
    </div>
  );
}

function StatusBadge({ status }: { status: ItemSummary['status'] }) {
  const map = {
    ready: { cls: 'status-ready', label: 'Ready' },
    processing: { cls: 'status-processing', label: 'Indexing…' },
    failed: { cls: 'status-failed', label: 'Failed' },
  };
  const { cls, label } = map[status];
  return (
    <span className={`item-status ${cls}`} aria-label={`Status: ${label}`}>
      {label}
    </span>
  );
}

function NoteModal({ item, onClose }: { item: ItemSummary; onClose: () => void }) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const textContent = item.rawContent || item.preview;

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="modal-card animate-in" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <span className={`item-type-badge ${item.sourceType === 'note' ? 'badge-note' : 'badge-url'}`}>
              {item.sourceType === 'note' ? 'Note' : 'URL'}
            </span>
            <h3 className="modal-title">{item.title}</h3>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-text-box">
            {textContent}
          </div>
        </div>

        <div className="modal-footer">
          <div className="modal-meta">
            <span>Saved on {formatDate(item.createdAt)}</span>
            {item.chunkCount > 0 && <span className="chunk-badge">{item.chunkCount} chunks</span>}
            {item.sourceUrl && (
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="item-url-link">
                ↗ {item.sourceUrl}
              </a>
            )}
          </div>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ item, onOpenModal }: { item: ItemSummary; onOpenModal: (item: ItemSummary) => void }) {
  if (item.status === 'processing') {
    return <SkeletonCard />;
  }

  return (
    <article className="item-card animate-in">
      <div className="item-card-top">
        <span className={`item-type-badge ${item.sourceType === 'note' ? 'badge-note' : 'badge-url'}`}>
          {item.sourceType === 'note' ? 'Note' : 'URL'}
        </span>
        <div className="item-title">{item.title}</div>
        <StatusBadge status={item.status} />
      </div>

      {item.preview && (
        <div
          className="item-preview"
          onClick={() => onOpenModal(item)}
          title="Click to view full text in centered card"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenModal(item); }}
        >
          {item.preview}
        </div>
      )}

      {item.status === 'ready' && (
        <button
          className="item-expand-btn"
          onClick={() => onOpenModal(item)}
          aria-label={`Read full ${item.sourceType}`}
        >
          Expand note ↗
        </button>
      )}

      {item.errorMessage && (
        <div className="item-error" role="alert">
          {item.errorMessage}
        </div>
      )}

      <div className="item-meta">
        <span>{formatDate(item.createdAt)}</span>
        {item.status === 'ready' && item.chunkCount > 0 && (
          <span className="chunk-badge">{item.chunkCount}c</span>
        )}
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="item-url-link"
            title={item.sourceUrl}
          >
            {new URL(item.sourceUrl).hostname}
          </a>
        )}
      </div>
    </article>
  );
}

export function ItemsPanel({ onCloseSidebar }: { onCloseSidebar?: () => void }) {
  const { data, isLoading, isFetching, error, refetch } = useItems();
  const [selectedItem, setSelectedItem] = useState<ItemSummary | null>(null);

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">Library</span>
        
        <div className="sidebar-cluster">
          {data && (
            <span className="sidebar-count">
              {data.items.length}
            </span>
          )}
          <button
            onClick={() => refetch()}
            className={`sidebar-refresh${isFetching ? ' refreshing' : ''}`}
            disabled={isFetching}
            title="Refresh library"
            aria-label="Refresh saved items"
          >
            ↻
          </button>
        </div>

        {onCloseSidebar && (
          <button
            onClick={onCloseSidebar}
            className="sidebar-close-btn"
            aria-label="Close library"
          >
            ×
          </button>
        )}
      </div>

      <div className="sidebar-body" role="list" aria-label="Saved knowledge items">
        {isLoading && (
          <div className="items-loading">
            <span className="spinner spinner-ink" aria-label="Loading" />
            <span>Loading…</span>
          </div>
        )}

        {error && (
          <div className="alert alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span className="alert-text">
              Failed to load.
              <button
                onClick={() => refetch()}
                style={{
                  color: 'var(--error)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  padding: 0,
                }}
              >
                Retry
              </button>
            </span>
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p className="empty-state-title">No items yet</p>
            <p className="empty-state-body">
              Add a note or URL to start building your knowledge base.
            </p>
          </div>
        )}

        {data && data.items.map((item) => (
          <div key={item.id} role="listitem">
            <ItemCard item={item} onOpenModal={setSelectedItem} />
          </div>
        ))}
      </div>

      {selectedItem && (
        <NoteModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </>
  );
}
