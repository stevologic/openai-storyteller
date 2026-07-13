import { useEffect } from 'react';
import { useStore } from './lib/store';
import { primeBrowserVoices } from './lib/providers/tts';
import Landing from './components/Landing';
import Studio from './components/Studio';
import SettingsPanel from './components/SettingsPanel';
import StoryReader from './components/reader/StoryReader';
import { IconSettings, IconSpark } from './components/icons';
import './app.css';

export default function App() {
  const view = useStore((s) => s.view);
  const story = useStore((s) => s.story);
  const setView = useStore((s) => s.setView);
  const openSettings = useStore((s) => s.openSettings);

  useEffect(() => {
    primeBrowserVoices();
  }, []);

  useEffect(() => {
    document.body.classList.toggle('scroll-lock', view === 'reader');
  }, [view]);

  const inReader = view === 'reader' && story;

  return (
    <>
      {!inReader && (
        <header className="nav">
          <div className="nav-inner container">
            <button className="brand" onClick={() => setView('landing')} aria-label="Tiny Book Buddies AI home">
              <span className="brand-mark">✦</span>
              <span className="brand-name">Tiny Book Buddies</span>
              <span className="brand-badge">AI</span>
            </button>
            <nav className="nav-actions">
              <button className="btn btn-ghost btn-sm" onClick={openSettings}>
                <IconSettings /> Models
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setView('studio')}>
                <IconSpark /> Create
              </button>
            </nav>
          </div>
        </header>
      )}

      <main>
        {view === 'landing' && <Landing />}
        {view === 'studio' && <Studio />}
        {inReader && <StoryReader story={story} />}
      </main>

      <SettingsPanel />
    </>
  );
}
