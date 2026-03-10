import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const DROPBOX_PATH = '/blob_vercel_replacement/blob_clipboard_content.txt';
const QR_DROPBOX_PATH = '/blob_vercel_replacement/blob_clipboard_qr.txt';
const PROMPTS_FOLDER = '/blob_vercel_replacement/clipboard_prompts';

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
  const [correctedFrom, setCorrectedFrom] = useState(null);
  const [promptFiles, setPromptFiles] = useState([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const lookupRef = useRef(null);
  const labelRef = useRef(null);
  const contentRef = useRef(null);

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
      // Load prompt files
      try {
        const files = await window.dropboxListFolder(PROMPTS_FOLDER);
        if (files) setPromptFiles(files);
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

  const correctDictation = async (text, labels) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a dictation corrector. The user dictated a shortcut label. Match it to one of these available labels: ${labels.join(', ')}. Handle homophones (e.g., "too" matches "two", "won" matches "one"). Return ONLY the exact matching label from the list, nothing else.`
            },
            { role: 'user', content: text }
          ]
        })
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.content?.trim().toLowerCase().replace(/\./g, '') || null;
    } catch {
      return null;
    }
  };

  const shortcutLookup = async (query) => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    setCorrectedFrom(null);
    let match = shortcuts.find(s => s.label.toLowerCase() === q);
    // If no match and has period, try without period
    let cleanedQ = q;
    if (!match && q.includes('.')) {
      cleanedQ = q.split('.').join('');
      match = shortcuts.find(s => s.label.toLowerCase() === cleanedQ);
      if (match) {
        setCorrectedFrom({ from: q, to: match.label });
        setLookupQuery(match.label);
      }
    }
    // If still no match and signed in to Dropbox, try OpenAI dictation correction
    if (!match && dbxSignedIn) {
      const firstWord = cleanedQ.split(' ')[0];
      const matchingLabels = shortcuts
        .filter(s => s.label.toLowerCase().includes(firstWord))
        .map(s => s.label);
      if (matchingLabels.length > 0) {
        const corrected = await correctDictation(cleanedQ, matchingLabels);
        if (corrected) {
          match = shortcuts.find(s => s.label.toLowerCase() === corrected);
          if (match) {
            setCorrectedFrom({ from: q, to: match.label });
            setLookupQuery(match.label);
          }
        }
      }
    }
    if (match) {
      try {
        await navigator.clipboard.writeText(match.content);
        setCopiedLabel(match.label);
        setTimeout(() => setCopiedLabel(null), 1500);
      } catch {
        alert('Failed to copy to clipboard');
      }
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

  const loadPromptFiles = useCallback(async () => {
    if (!window.getDropboxAccessToken || !window.getDropboxAccessToken()) return;
    setPromptsLoading(true);
    try {
      const files = await window.dropboxListFolder(PROMPTS_FOLDER);
      setPromptFiles(files || []);
    } catch {
      setPromptFiles([]);
    }
    setPromptsLoading(false);
  }, []);

  const handlePromptSelect = async (path) => {
    if (!path) return;
    try {
      const content = await window.dropboxDownloadFile(path);
      if (content) {
        await navigator.clipboard.writeText(content);
        alert('Prompt copied to clipboard!');
      }
    } catch {
      alert('Failed to load prompt file');
    }
  };

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

        <div className="prompts-section">
          <div className="prompts-header">
            <h2>Prompts <span className="prompts-path-hint">(blob_vercel_replacement/clipboard_prompts)</span></h2>
            <button onClick={loadPromptFiles} className="shortcuts-btn refresh-btn" disabled={promptsLoading}>
              {promptsLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          <select
            className="prompts-select"
            defaultValue=""
            onChange={(e) => { handlePromptSelect(e.target.value); e.target.value = ''; }}
          >
            <option value="" disabled>Select a prompt to copy...</option>
            {promptFiles.map((f) => (
              <option key={f.path} value={f.path}>{f.name}</option>
            ))}
          </select>
        </div>

        <div className="shortcuts-section">
          <div className="shortcuts-header">
            <h2>Shortcuts</h2>
            <button onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                const cleaned = text.trim();
                setLookupQuery(cleaned);
                setTimeout(() => shortcutLookup(cleaned), 500);
              } catch (err) {
                console.error('Clipboard error:', err);
                alert('Failed to read from clipboard. Make sure you have granted clipboard permissions.');
              }
            }} className="shortcuts-btn paste-clip-btn">Paste from Clipboard</button>
          </div>

          <div className="shortcuts-lookup-row">
            <div className="input-wrap">
              <input
                ref={lookupRef}
                type="text"
                value={lookupQuery}
                onChange={(e) => { setLookupQuery(e.target.value); setCorrectedFrom(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') shortcutLookup(lookupQuery); }}
                placeholder="Type a label to lookup..."
                className="shortcuts-input"
              />
              <button className="input-clear-btn" onClick={() => { setLookupQuery(''); setCorrectedFrom(null); lookupRef.current.focus(); }}>&times;</button>
            </div>
            <button onClick={() => shortcutLookup(lookupQuery)} className="shortcuts-btn lookup-btn">Lookup</button>
          </div>
          {correctedFrom && (
            <div className="correction-display">
              Corrected: "{correctedFrom.from}" → "{correctedFrom.to}"
            </div>
          )}

          <div className="shortcuts-add-row">
            <div className="input-wrap">
              <input
                ref={labelRef}
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Label"
                className="shortcuts-input shortcuts-label-input"
              />
              <button className="input-clear-btn" onClick={() => { setNewLabel(''); labelRef.current.focus(); }}>&times;</button>
            </div>
            <div className="input-wrap input-wrap-grow">
              <input
                ref={contentRef}
                type="text"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addShortcut(); }}
                placeholder="URL or command"
                className="shortcuts-input shortcuts-content-input"
              />
              <button className="input-clear-btn" onClick={() => { setNewContent(''); contentRef.current.focus(); }}>&times;</button>
            </div>
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
