import { IngestPanel } from './components/IngestPanel.js';
import { ItemsPanel } from './components/ItemsPanel.js';
import { QueryPanel } from './components/QueryPanel.js';

export default function App() {
  return (
    <div className="app-layout">
      {/* Header */}
      <header className="header" role="banner">
        <div className="header-logo" aria-hidden="true">🧠</div>
        <div className="header-text">
          <h1>AI Knowledge Inbox</h1>
          <p>Save notes & URLs · Ask questions · Get grounded answers with citations</p>
        </div>
      </header>

      {/* Main Layout */}
      <main className="main-grid" role="main">
        {/* Left Column: Ingest + Items */}
        <div className="left-column">
          <IngestPanel />
          <ItemsPanel />
        </div>

        {/* Right Column: Query + Answer */}
        <div className="right-column">
          <QueryPanel />
        </div>
      </main>
    </div>
  );
}
