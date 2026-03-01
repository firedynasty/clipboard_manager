import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const DROPBOX_PATH = '/blob_vercel_replacement/blob_clipboard_content.txt';
const QR_DROPBOX_PATH = '/blob_vercel_replacement/blob_clipboard_qr.txt';

function App() {
  const [textboxContent, setTextboxContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [autoSave, setAutoSave] = useState(false);
  const autoSaveTimer = useRef(null);
  const [dbxSignedIn, setDbxSignedIn] = useState(false);

  // Shortcuts state
  const [shortcuts, setShortcuts] = useState([]);
  const [lookupQuery, setLookupQuery] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newContent, setNewContent] = useState('');
  const [copiedLabel, setCopiedLabel] = useState(null);

  const parseShortcuts = (text) => {
    if (!text) return [];
    return text.split('\n').filter(line => line.trim()).map(line => {
      const idx = line.indexOf(',');
      if (idx === -1) return { label: line.trim(), content: '' };
      return { label: line.substring(0, idx).trim(), content: line.substring(idx + 1).trim() };
    });
  };

  const loadShortcuts = useCallback(async () => {
    if (!window.getDropboxAccessToken || !window.getDropboxAccessToken()) return;
    try {
      const text = await window.dropboxDownloadFile(QR_DROPBOX_PATH);
      if (text) setShortcuts(parseShortcuts(text));
    } catch {}
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (window._dropboxReady) await window._dropboxReady;
      const signedIn = !!(window.getDropboxAccessToken && window.getDropboxAccessToken());
      setDbxSignedIn(signedIn);
      if (!signedIn) return;
      try {
        const content = await window.dropboxDownloadFile(DROPBOX_PATH);
        if (content) setSavedContent(content);
      } catch {}
      // Load shortcuts alongside main content
      try {
        const text = await window.dropboxDownloadFile(QR_DROPBOX_PATH);
        if (text) setShortcuts(parseShortcuts(text));
      } catch {}
    };
    loadData();
  }, []);

  const saveContent = useCallback(async (content, { silent = false } = {}) => {
    if (content.trim()) {
      setSavedContent(content);
      if (!window.getDropboxAccessToken || !window.getDropboxAccessToken()) {
        if (!silent) alert('Sign in to Dropbox first');
        return;
      }
      try {
        await window.dropboxUploadFile(DROPBOX_PATH, content);
      } catch (error) {
        if (!silent) throw error;
      }
    }
  }, []);

  useEffect(() => {
    if (!autoSave) return;
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }
    autoSaveTimer.current = setTimeout(() => {
      saveContent(textboxContent, { silent: true }).catch(() => {});
    }, 3000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [textboxContent, autoSave, saveContent]);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setTextboxContent(text);
    } catch (error) {
      alert('Failed to read from clipboard');
    }
  };

  const save = async () => {
    if (textboxContent.trim()) {
      try {
        await saveContent(textboxContent);
      } catch (error) {
        alert('Failed to save to Dropbox');
      }
    }
  };

  const append = async () => {
    if (textboxContent.trim()) {
      try {
        const combined = savedContent
          ? savedContent + '\n' + textboxContent
          : textboxContent;
        await saveContent(combined);
      } catch (error) {
        alert('Failed to append to Dropbox');
      }
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(savedContent);
      alert('Copied to clipboard!');
    } catch (error) {
      alert('Failed to copy to clipboard');
    }
  };

  const goToLink = () => {
    const url = savedContent.trim();
    if (/^https?:\/\//i.test(url)) {
      window.open(url, '_blank', 'noopener');
    } else {
      alert('Saved content is not a valid URL');
    }
  };

  const shortcutLookup = async (query) => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    const match = shortcuts.find(s => s.label.toLowerCase() === q);
    if (match) {
      try {
        await navigator.clipboard.writeText(match.content);
        setCopiedLabel(match.label);
        setTimeout(() => setCopiedLabel(null), 1500);
      } catch {
        alert('Failed to copy to clipboard');
      }
    } else {
      alert('No shortcut found for "' + query.trim() + '"');
    }
  };

  const addShortcut = async () => {
    const label = newLabel.trim();
    const content = newContent.trim();
    if (!label || !content) { alert('Both label and content are required'); return; }
    if (!window.getDropboxAccessToken || !window.getDropboxAccessToken()) { alert('Sign in to Dropbox first'); return; }
    const newLine = label + ',' + content;
    const updated = shortcuts.length > 0
      ? shortcuts.map(s => s.label + ',' + s.content).join('\n') + '\n' + newLine
      : newLine;
    try {
      await window.dropboxUploadFile(QR_DROPBOX_PATH, updated);
      setShortcuts(parseShortcuts(updated));
      setNewLabel('');
      setNewContent('');
    } catch {
      alert('Failed to save shortcut to Dropbox');
    }
  };

  const deleteShortcut = async (index) => {
    if (!window.getDropboxAccessToken || !window.getDropboxAccessToken()) { alert('Sign in to Dropbox first'); return; }
    const updated = shortcuts.filter((_, i) => i !== index);
    const text = updated.map(s => s.label + ',' + s.content).join('\n');
    try {
      await window.dropboxUploadFile(QR_DROPBOX_PATH, text || ' ');
      setShortcuts(updated);
    } catch {
      alert('Failed to delete shortcut from Dropbox');
    }
  };

  const copyShortcutContent = async (shortcut) => {
    try {
      await navigator.clipboard.writeText(shortcut.content);
      setCopiedLabel(shortcut.label);
      setTimeout(() => setCopiedLabel(null), 1500);
    } catch {
      alert('Failed to copy to clipboard');
    }
  };

  const filteredShortcuts = lookupQuery.trim()
    ? shortcuts.filter(s => s.label.toLowerCase().includes(lookupQuery.trim().toLowerCase()))
    : shortcuts;

  const loadFromDropbox = async () => {
    if (!window.getDropboxAccessToken || !window.getDropboxAccessToken()) {
      alert('Sign in to Dropbox first');
      return;
    }
    try {
      const content = await window.dropboxDownloadFile(DROPBOX_PATH);
      if (content) setSavedContent(content);
      else alert('No saved content found in Dropbox');
    } catch {
      alert('Failed to load from Dropbox');
    }
  };

  const handleDropboxSignOut = async () => {
    if (window.dropboxSignOut) await window.dropboxSignOut();
    setDbxSignedIn(false);
    setSavedContent('');
  };

  return (
    <div className="App">
      <div className="container">
        <div className="dropbox-bar">
          {dbxSignedIn ? (
            <>
              <span className="dbx-status">Dropbox: Connected</span>
              <button onClick={loadFromDropbox} className="dbx-link-btn">Load</button>
              <button onClick={handleDropboxSignOut} className="dbx-link-btn">Sign Out</button>
            </>
          ) : (
            <>
              <span className="dbx-status">Dropbox: Not connected</span>
              <button onClick={() => window.dropboxSignIn && window.dropboxSignIn()} className="dbx-link-btn">Sign In</button>
            </>
          )}
        </div>

        <h1>Clipboard Manager</h1>

        <textarea
          value={textboxContent}
          onChange={(e) => setTextboxContent(e.target.value)}
          placeholder="Paste or type text here..."
          rows="3"
        />

        <div className="auto-save-toggle">
          <label className="toggle-label">
            <span>Auto Save</span>
            <div className={`toggle-switch ${autoSave ? 'active' : ''}`} onClick={() => setAutoSave(!autoSave)}>
              <div className="toggle-knob" />
            </div>
          </label>
        </div>

        <div className="buttons">
          <button onClick={pasteFromClipboard} className="paste-button">
            Paste from Clipboard
          </button>
          <button onClick={() => setTextboxContent(savedContent)} className="paste-button">
            Paste from Saved
          </button>
          <button onClick={save} className="save-button">
            Save
          </button>
          <button onClick={append} className="save-button">
            Append
          </button>
        </div>

        {savedContent && (
          <div className="saved-section">
            <div className="saved-content">{savedContent}</div>
            <div className="saved-actions">
              <button onClick={copyToClipboard} className="copy-button">
                Copy to Clipboard
              </button>
              <button onClick={goToLink} className="go-link-button">
                Go to Link
              </button>
              <button onClick={loadFromDropbox} className="go-link-button">
                Refresh
              </button>
            </div>
          </div>
        )}

        <div className="shortcuts-section">
          <h2>Shortcuts</h2>

          <div className="shortcuts-lookup-row">
            <input
              type="text"
              value={lookupQuery}
              onChange={(e) => setLookupQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') shortcutLookup(lookupQuery); }}
              placeholder="Type a label to lookup..."
              className="shortcuts-input"
            />
            <button onClick={() => shortcutLookup(lookupQuery)} className="shortcuts-btn lookup-btn">Lookup</button>
          </div>

          <div className="shortcuts-add-row">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Label"
              className="shortcuts-input shortcuts-label-input"
            />
            <input
              type="text"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addShortcut(); }}
              placeholder="URL or command"
              className="shortcuts-input shortcuts-content-input"
            />
            <button onClick={addShortcut} className="shortcuts-btn add-btn">Add</button>
          </div>

          <div className="shortcuts-list-header">
            <span>{filteredShortcuts.length} shortcut{filteredShortcuts.length !== 1 ? 's' : ''}</span>
            <button onClick={loadShortcuts} className="shortcuts-btn refresh-btn">Refresh</button>
          </div>

          <div className="shortcuts-list">
            {filteredShortcuts.map((s, i) => {
              const originalIndex = shortcuts.indexOf(s);
              return (
                <div key={originalIndex} className="shortcuts-item" onClick={() => copyShortcutContent(s)}>
                  <span className="shortcuts-item-label">{s.label}</span>
                  <span className="shortcuts-item-content">{s.content}</span>
                  {copiedLabel === s.label && <span className="shortcuts-copied">Copied!</span>}
                  <button
                    className="shortcuts-delete-btn"
                    onClick={(e) => { e.stopPropagation(); deleteShortcut(originalIndex); }}
                    title="Delete"
                  >&times;</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
