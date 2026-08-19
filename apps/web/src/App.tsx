import { useState, useEffect, useCallback } from 'react';
import { IngestPanel } from './components/IngestPanel.js';
import { ItemsPanel } from './components/ItemsPanel.js';
import { QueryPanel } from './components/QueryPanel.js';

export default function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close drawer on Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [drawerOpen]);

  // Prevent body scroll when drawer or sidebar is open
  useEffect(() => {
    document.body.style.overflow = (drawerOpen || sidebarOpen) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen, sidebarOpen]);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen(v => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="header" role="banner">
        <div className="header-brand">
          <div className="header-logo" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04" />
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04" />
            </svg>
          </div>
          <div>
            <h1 className="header-title">AI Knowledge Inbox</h1>
            <p className="header-subtitle">save · index · ask</p>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-expanded={sidebarOpen}
            aria-controls="sidebar"
            aria-label="Toggle library"
          >
            📚 Library
          </button>

          <button
            className="btn-add"
            onClick={openDrawer}
            aria-haspopup="dialog"
            aria-expanded={drawerOpen}
            id="add-content-btn"
          >
            <span aria-hidden="true">+</span>
            Add content
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="app-body">
        {sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        <aside
          id="sidebar"
          className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}
          aria-label="Saved knowledge"
        >
          <ItemsPanel onCloseSidebar={closeSidebar} />
        </aside>

        <main className="main-content" role="main">
          <div className="content-column">
            <QueryPanel />
          </div>
        </main>
      </div>

      {/* Ingest Drawer */}
      {drawerOpen && (
        <>
          <div
            className="drawer-overlay"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div
            className="drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Add content to knowledge base"
          >
            <div className="drawer-header">
              <span className="drawer-title">Add to Knowledge Base</span>
              <button
                className="drawer-close"
                onClick={closeDrawer}
                aria-label="Close drawer"
              >
                ×
              </button>
            </div>
            <div className="drawer-body">
              <IngestPanel onSuccess={closeDrawer} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
