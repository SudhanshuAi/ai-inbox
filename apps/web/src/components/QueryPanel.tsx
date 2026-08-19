import { useState, useRef, useCallback } from 'react';
import { useQuery2 } from '../hooks/useApi.js';
import { QueryResponse, ApiError, SourceRecord } from '@ai-inbox/contracts';

// ── Formatted text renderer ───────────────────────────────────────────────
function renderFormattedText(
  text: string,
  sources: SourceRecord[],
  onCiteClick: (label: string) => void,
  activeCite: string | null,
): React.ReactNode {
  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    const isBullet = /^\s*[*|-]\s+/.test(line);
    const cleanLine = isBullet ? line.replace(/^\s*[*|-]\s+/, '') : line;
    const parts = cleanLine.split(/(\*\*[^*]+\*\*|\[\d+\])/g);

    const inlineContent = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      const citeMatch = part.match(/^\[(\d+)\]$/);
      if (citeMatch) {
        const label = `[${citeMatch[1]}]`;
        const source = sources.find((s) => s.citationLabel === label);
        const isActive = activeCite === label;
        return (
          <span
            key={i}
            className={`citation-ref${isActive ? ' active' : ''}`}
            title={source ? source.title : label}
            aria-label={`Citation ${label}${source ? ': ' + source.title : ''}`}
            onClick={() => onCiteClick(label)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCiteClick(label); }}
          >
            {label}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });

    if (isBullet) {
      return (
        <div key={lineIdx} className="answer-bullet">
          <span className="answer-bullet-dot" aria-hidden="true">•</span>
          <div>{inlineContent}</div>
        </div>
      );
    }

    return (
      <div key={lineIdx} style={{ minHeight: line === '' ? '0.6em' : 'auto' }}>
        {inlineContent}
      </div>
    );
  });
}

// ── Source card (expandable) ──────────────────────────────────────────────
function SourceCard({
  source,
  highlighted,
}: {
  source: SourceRecord;
  highlighted: boolean;
}) {
  return (
    <details
      className={`source-card${highlighted ? ' highlighted' : ''}`}
      id={`source-${source.citationLabel.replace(/[\[\]]/g, '')}`}
    >
      <summary className="source-card-summary">
        <span className="citation-label">{source.citationLabel}</span>
        <span
          className={`source-type-pill ${
            source.sourceType === 'note' ? 'badge-note' : 'badge-url'
          }`}
        >
          {source.sourceType}
        </span>
        <span className="source-title">{source.title}</span>
        <span className="source-score" title="Relevance score">
          {(source.score * 100).toFixed(0)}%
        </span>
        <span className="source-chevron" aria-hidden="true">▾</span>
      </summary>

      <div className="source-card-detail">
        {source.sourceUrl && (
          <a
            href={source.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="source-url-link"
          >
            ↗ {source.sourceUrl}
          </a>
        )}
        <blockquote className="source-snippet">{source.snippet}</blockquote>
      </div>
    </details>
  );
}

// ── QueryPanel ───────────────────────────────────────────────────────────
export function QueryPanel() {
  const [question, setQuestion] = useState('');
  const [lastResult, setLastResult] = useState<QueryResponse | null>(null);
  const [activeCite, setActiveCite] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const sourceRefs = useRef<Record<string, HTMLElement | null>>({});

  const { mutate, isPending, error, reset } = useQuery2();
  const apiError = error as (ApiError & { status?: number }) | null;

  const handleCiteClick = useCallback((label: string) => {
    setActiveCite(prev => prev === label ? null : label);
    // Scroll the matching source card into view
    const id = label.replace(/[\[\]]/g, '');
    const el = document.getElementById(`source-${id}`);
    if (el) {
      (el as HTMLDetailsElement).open = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    reset();
    setLastResult(null);
    setActiveCite(null);

    mutate(
      { question: question.trim() },
      {
        onSuccess: (data) => {
          setLastResult(data);
          setTimeout(() => resultRef.current?.focus(), 50);
        },
      },
    );
  }

  return (
    <>
      {/* Question — Hero */}
      <div className="qa-hero">
        <div className="qa-hero-header">
          <p className="qa-hero-label">Ask your knowledge base</p>
          <h2 className="qa-hero-title">What do you want to know?</h2>
          <p className="qa-hero-sub">Your answer will be grounded in your saved notes and URLs.</p>
        </div>

        <div className="qa-body">
          <form onSubmit={handleSubmit}>
            <label htmlFor="question-input" className="sr-only">
              Your question
            </label>
            <textarea
              id="question-input"
              className="question-textarea"
              placeholder="e.g. What are the main themes from my recent reading?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              maxLength={2000}
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (question.trim() && !isPending) handleSubmit(e as any);
                }
              }}
            />

            {apiError && (
              <div className="alert alert-error animate-in" role="alert" aria-live="assertive" style={{ marginTop: '12px' }}>
                <span className="alert-icon">⚠️</span>
                <div className="alert-text">
                  <div>
                    {apiError.status === 409
                      ? 'No indexed content yet — add some notes or URLs first!'
                      : apiError.message}
                  </div>
                  {apiError.requestId && (
                    <div className="alert-code">Request ID: {apiError.requestId}</div>
                  )}
                </div>
              </div>
            )}

            <div className="qa-actions">
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
                {isPending ? '' : '⌘⏎ to ask'}
              </span>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isPending || !question.trim()}
                aria-busy={isPending}
              >
                {isPending ? (
                  <>
                    <span className="dot-loader" aria-label="Thinking" aria-hidden="true">
                      <span /><span /><span />
                    </span>
                    Thinking…
                  </>
                ) : (
                  <>✨ Ask</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Answer */}
      {lastResult && (
        <div
          className="answer-panel"
          ref={resultRef}
          tabIndex={-1}
          aria-label="Answer"
        >
          <div className="answer-header">
            <span className="answer-label">✨ Answer</span>
            {lastResult.sources.length > 0 && (
              <span className="answer-meta">
                {lastResult.sources.length} source{lastResult.sources.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="answer-body" role="region" aria-label="AI-generated answer">
            {renderFormattedText(lastResult.answer, lastResult.sources, handleCiteClick, activeCite)}
          </div>

          {lastResult.sources.length > 0 && (
            <div className="sources-section">
              <p className="sources-title">Sources ({lastResult.sources.length})</p>
              <div className="source-cards" role="list" aria-label="Citation sources">
                {lastResult.sources.map((source) => (
                  <div key={source.citationLabel} role="listitem">
                    <SourceCard
                      source={source}
                      highlighted={activeCite === source.citationLabel}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!lastResult && !isPending && !apiError && (
        <div className="answer-panel animate-fade">
          <div className="empty-state" style={{ padding: 'var(--sp-5) var(--sp-4)' }}>
            <div className="empty-state-icon">💬</div>
            <p className="empty-state-title">Ask anything</p>
            <p className="empty-state-body">
              Your answer will appear here with citations pointing back to your saved sources.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
