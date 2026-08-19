import { useState } from 'react';
import { useIngest } from '../hooks/useApi.js';
import { ApiError } from '@ai-inbox/contracts';

type Mode = 'note' | 'url';

export function IngestPanel({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<Mode>('note');
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { mutate, isPending, error, reset } = useIngest();

  const apiError = error as (ApiError & { status?: number }) | null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccessMsg('');
    reset();

    if (mode === 'note') {
      mutate(
        { type: 'note', content: noteContent, title: noteTitle || undefined },
        {
          onSuccess: (data) => {
            setSuccessMsg(`"${data.item.title}" saved and indexed successfully!`);
            setNoteContent('');
            setNoteTitle('');
            setTimeout(() => onSuccess?.(), 1200);
          },
        },
      );
    } else {
      mutate(
        { type: 'url', url: urlInput },
        {
          onSuccess: (data) => {
            setSuccessMsg(`"${data.item.title}" fetched and indexed!`);
            setUrlInput('');
            setTimeout(() => onSuccess?.(), 1200);
          },
        },
      );
    }
  }

  const isValid = mode === 'note' ? noteContent.trim().length > 0 : urlInput.trim().length > 0;

  return (
    <div>
        {/* Mode Tabs */}
        <div className="tab-list" role="tablist" aria-label="Ingestion mode">
          <button
            role="tab"
            aria-selected={mode === 'note'}
            className={`tab-btn ${mode === 'note' ? 'active' : ''}`}
            onClick={() => { setMode('note'); reset(); setSuccessMsg(''); }}
            id="tab-note"
          >
            📝 Note
          </button>
          <button
            role="tab"
            aria-selected={mode === 'url'}
            className={`tab-btn ${mode === 'url' ? 'active' : ''}`}
            onClick={() => { setMode('url'); reset(); setSuccessMsg(''); }}
            id="tab-url"
          >
            🔗 URL
          </button>
        </div>

        <form onSubmit={handleSubmit} aria-labelledby={`tab-${mode}`}>
          {mode === 'note' ? (
            <>
              <div className="form-group">
                <label htmlFor="note-title">Title (optional)</label>
                <input
                  id="note-title"
                  type="text"
                  placeholder="Leave blank to auto-derive from content"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  maxLength={200}
                  disabled={isPending}
                />
              </div>
              <div className="form-group">
                <label htmlFor="note-content">Note Content *</label>
                <textarea
                  id="note-content"
                  placeholder="Paste your note, article excerpt, or any text you want to save…"
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  rows={6}
                  maxLength={100_000}
                  required
                  disabled={isPending}
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label htmlFor="url-input">Web URL *</label>
              <input
                id="url-input"
                type="url"
                placeholder="https://example.com/article"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                required
                disabled={isPending}
              />
              <p className="field-hint">
                The server will fetch and extract readable text from this page.
              </p>
            </div>
          )}

          {/* Error */}
          {apiError && (
            <div className="alert alert-error animate-in" role="alert" aria-live="polite">
              <span className="alert-icon">⚠️</span>
              <div className="alert-text">
                <div>{apiError.message}</div>
                {apiError.requestId && (
                  <div className="alert-code">Request ID: {apiError.requestId}</div>
                )}
              </div>
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div className="alert alert-success animate-in" role="status" aria-live="polite">
              <span className="alert-icon">✅</span>
              <div className="alert-text">{successMsg}</div>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: '16px' }}
            disabled={isPending || !isValid}
            aria-busy={isPending}
          >
            {isPending ? (
              <>
                <span className="spinner" aria-hidden="true" />
                {mode === 'url' ? 'Fetching & indexing…' : 'Saving & indexing…'}
              </>
            ) : (
              <>{mode === 'url' ? '🔗 Fetch & Save' : '💾 Save & Index'}</>
            )}
          </button>
        </form>
    </div>
  );
}
