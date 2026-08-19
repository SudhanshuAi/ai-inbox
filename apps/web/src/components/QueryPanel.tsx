import { useState, useRef } from 'react';
import { useQuery2 } from '../hooks/useApi.js';
import { QueryResponse, ApiError, SourceRecord } from '@ai-inbox/contracts';

function renderFormattedText(text: string, sources: SourceRecord[]): React.ReactNode {
  const lines = text.split('\n');

  return lines.map((line, lineIdx) => {
    // Check if line is a bullet point
    const isBullet = /^\s*[*|-]\s+/.test(line);
    const cleanLine = isBullet ? line.replace(/^\s*[*|-]\s+/, '') : line;

    // Process bold (**text**) and citations ([N]) within the line
    const parts = cleanLine.split(/(\*\*[^*]+\*\*|\[\d+\])/g);

    const inlineContent = parts.map((part, i) => {
      // Bold match
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      // Citation match
      const citeMatch = part.match(/^\[(\d+)\]$/);
      if (citeMatch) {
        const label = `[${citeMatch[1]}]`;
        const source = sources.find((s) => s.citationLabel === label);
        return (
          <span
            key={i}
            className="citation-ref"
            title={source ? source.title : label}
            aria-label={`Citation ${label}${source ? ': ' + source.title : ''}`}
          >
            {label}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });

    if (isBullet) {
      return (
        <div key={lineIdx} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginLeft: '12px', margin: '4px 0' }}>
          <span style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>•</span>
          <div>{inlineContent}</div>
        </div>
      );
    }

    return (
      <div key={lineIdx} style={{ minHeight: line === '' ? '0.5em' : 'auto' }}>
        {inlineContent}
      </div>
    );
  });
}

function SourceCard({ source }: { source: SourceRecord }) {
  return (
    <div className="source-card">
      <div className="source-card-header">
        <span className="citation-label">{source.citationLabel}</span>
        <span className="source-title">{source.title}</span>
        <span className={`item-type-badge ${source.sourceType === 'note' ? 'badge-note' : 'badge-url'}`} style={{ fontSize: '0.6rem' }}>
          {source.sourceType}
        </span>
        <span className="source-score" title="Relevance score">
          {(source.score * 100).toFixed(0)}% match
        </span>
      </div>
      {source.sourceUrl && (
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="item-url-link"
          style={{ display: 'block', marginBottom: '8px', fontSize: '0.72rem' }}
        >
          ↗ {source.sourceUrl}
        </a>
      )}
      <blockquote className="source-snippet">{source.snippet}</blockquote>
    </div>
  );
}

export function QueryPanel() {
  const [question, setQuestion] = useState('');
  const [lastResult, setLastResult] = useState<QueryResponse | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const { mutate, isPending, error, reset } = useQuery2();
  const apiError = error as (ApiError & { status?: number }) | null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    reset();
    setLastResult(null);

    mutate(
      { question: question.trim() },
      {
        onSuccess: (data) => {
          setLastResult(data);
          // Move focus to result for accessibility
          setTimeout(() => resultRef.current?.focus(), 50);
        },
      },
    );
  }

  return (
    <div>
      {/* Question Panel */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-icon">🔍</div>
          <span className="panel-title">Ask a Question</span>
        </div>
        <div className="panel-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="question-input">Your Question</label>
              <textarea
                id="question-input"
                className="question-textarea"
                placeholder="What do you want to know from your saved knowledge?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                maxLength={2000}
                disabled={isPending}
              />
            </div>

            {apiError && (
              <div className="alert alert-error animate-in" role="alert" aria-live="assertive">
                <span className="alert-icon">⚠️</span>
                <div className="alert-text">
                  <div>
                    {apiError.status === 409
                      ? 'No indexed content available. Add some notes or URLs first!'
                      : apiError.message}
                  </div>
                  {apiError.requestId && (
                    <div className="alert-code">Request ID: {apiError.requestId}</div>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-full"
              style={{ marginTop: '14px' }}
              disabled={isPending || !question.trim()}
              aria-busy={isPending}
            >
              {isPending ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Searching & answering…
                </>
              ) : (
                '✨ Ask'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Answer Panel */}
      {lastResult && (
        <div
          className="answer-panel animate-in"
          ref={resultRef}
          tabIndex={-1}
          aria-label="Answer"
          style={{ marginTop: '20px' }}
        >
          <div className="answer-header">
            <div className="panel-icon">💡</div>
            <span className="panel-title">Answer</span>
          </div>

          <div className="answer-text" role="region" aria-label="AI-generated answer">
            {renderFormattedText(lastResult.answer, lastResult.sources)}
          </div>

          {lastResult.sources.length > 0 && (
            <div className="sources-section">
              <div className="sources-title">
                📎 Sources ({lastResult.sources.length})
              </div>
              <div className="source-cards" role="list" aria-label="Citation sources">
                {lastResult.sources.map((source) => (
                  <div key={source.citationLabel} role="listitem">
                    <SourceCard source={source} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!lastResult && !isPending && !apiError && (
        <div className="answer-panel" style={{ marginTop: '20px' }}>
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <div className="empty-state-icon">💬</div>
            <h3>Ask anything</h3>
            <p>Your answer will appear here with citations<br />pointing back to your saved sources.</p>
          </div>
        </div>
      )}
    </div>
  );
}
