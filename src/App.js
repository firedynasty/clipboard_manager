import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const DROPBOX_PATH = '/blob_vercel_replacement/blob_clipboard_content.txt';
const QR_DROPBOX_PATH = '/blob_vercel_replacement/blob_clipboard_qr.txt';
const PROMPTS_FOLDER = '/blob_vercel_replacement/clipboard_prompts';
const ACCUMULATOR_PATH = '/blob_vercel_replacement/blob_clipboard_accumulator.txt';


function App() {
  const [textboxContent, setTextboxContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [autoSave, setAutoSave] = useState(false);
  const autoSaveTimer = useRef(null);
  const [dbxSignedIn, setDbxSignedIn] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved'
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Shortcuts state
  const [shortcuts, setShortcuts] = useState([]);
  const [lookupQuery, setLookupQuery] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newContent, setNewContent] = useState('');
  const [copiedLabel, setCopiedLabel] = useState(null);
  const [correctedFrom, setCorrectedFrom] = useState(null);
  const [promptFiles, setPromptFiles] = useState([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptContent, setPromptContent] = useState(null);
  const [promptName, setPromptName] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Accumulator state (Dropbox-backed)
  const [accOutput, setAccOutput] = useState('');
  const [accStatus, setAccStatus] = useState('');
  const [isEditingAcc, setIsEditingAcc] = useState(false);

  const lookupRef = useRef(null);
  const labelRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    const handleClickOutside = (e) => {
      if (!e.target.closest('.tool-dropdown')) {
        document.querySelectorAll('.tool-dropdown.open').forEach(el => el.classList.remove('open'));
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const parseShortcuts = (text) => {
    if (!text) return [];
    return text.split('\n').filter(line => line.trim()).map(line => {
      const idx = line.indexOf(',');
      if (idx === -1) return { label: line.trim(), content: '' };
      return { label: line.substring(0, idx).trim(), content: line.substring(idx + 1).trim() };
    });
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2000);
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
      // Load accumulator
      try {
        const accText = await window.dropboxDownloadFile(ACCUMULATOR_PATH);
        if (accText) setAccOutput(accText);
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
      setSaveStatus('saving');
      try {
        await saveContent(textboxContent);
        // Also append to accumulator
        if (window.getDropboxAccessToken && window.getDropboxAccessToken()) {
          try {
            let current = '';
            try { current = await window.dropboxDownloadFile(ACCUMULATOR_PATH) || ''; } catch {}
            const updated = current.trim() ? current.trim() + '\n\n' + textboxContent : textboxContent;
            await window.dropboxUploadFile(ACCUMULATOR_PATH, updated);
            setAccOutput(updated);
          } catch {}
        }
        if (isMobile) setTextboxContent('');
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
      } catch (error) {
        setSaveStatus(null);
        alert('Failed to save to Dropbox');
      }
    }
  };

  const append = async () => {
    if (textboxContent.trim()) {
      setSaveStatus('saving');
      try {
        const combined = savedContent
          ? savedContent + '\n' + textboxContent
          : textboxContent;
        await saveContent(combined);
        if (isMobile) setTextboxContent('');
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus(null), 2000);
      } catch (error) {
        setSaveStatus(null);
        alert('Failed to append to Dropbox');
      }
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(savedContent);
      showToast('Copied to clipboard!');
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
    console.log('[Prompts] Loading prompt files from:', PROMPTS_FOLDER);
    if (!window.getDropboxAccessToken || !window.getDropboxAccessToken()) {
      console.warn('[Prompts] No Dropbox access token available');
      return;
    }
    setPromptsLoading(true);
    try {
      const files = await window.dropboxListFolder(PROMPTS_FOLDER);
      console.log('[Prompts] Loaded files:', files);
      setPromptFiles(files || []);
    } catch (err) {
      console.error('[Prompts] Failed to load prompt files:', err);
      setPromptFiles([]);
    }
    setPromptsLoading(false);
  }, []);

  const handlePromptSelect = async (path, name) => {
    if (!path) return;
    console.log('[Prompts] Selected path:', path);
    try {
      const content = await window.dropboxDownloadFile(path);
      console.log('[Prompts] Dropbox response, content length:', content ? content.length : 0);
      if (content) {
        setPromptContent(content);
        setPromptName(name);
      } else {
        alert('Prompt file was empty');
      }
    } catch (err) {
      console.error('[Prompts] Failed to fetch prompt:', err);
      alert('Failed to load prompt file');
    }
  };

  const handleCopyPrompt = async () => {
    if (!promptContent) return;
    try {
      await navigator.clipboard.writeText(promptContent);
      console.log('[Prompts] Copied to clipboard via writeText');
    } catch {
      console.warn('[Prompts] writeText failed, using execCommand fallback');
      const textarea = document.createElement('textarea');
      textarea.value = promptContent;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    alert('Prompt copied to clipboard!');
    setPromptContent(null);
    setPromptName('');
  };

  const loadFromDropbox = async () => {
    if (!window.getDropboxAccessToken || !window.getDropboxAccessToken()) {
      alert('Sign in to Dropbox first');
      return;
    }
    try {
      const content = await window.dropboxDownloadFile(DROPBOX_PATH);
      if (content) {
        setSavedContent(content);
        try {
          await navigator.clipboard.writeText(content);
        } catch {}
      } else {
        alert('No saved content found in Dropbox');
      }
    } catch {
      alert('Failed to load from Dropbox');
    }
  };

  const handleDropboxSignOut = async () => {
    if (window.dropboxSignOut) await window.dropboxSignOut();
    setDbxSignedIn(false);
    setSavedContent('');
  };

  // Accumulator functions (Dropbox-backed)
  const accFlashStatus = (msg) => {
    setAccStatus(msg);
    setTimeout(() => setAccStatus(''), 2000);
  };

  // Load/refresh accumulator from Dropbox
  const accLoad = async () => {
    if (!window.getDropboxAccessToken || !window.getDropboxAccessToken()) return;
    try {
      const text = await window.dropboxDownloadFile(ACCUMULATOR_PATH);
      setAccOutput(text || '');
      accFlashStatus('Loaded');
    } catch {
      alert('Failed to load accumulator');
    }
  };

  // Save edits back to Dropbox (called on blur)
  const accSaveEdits = async () => {
    setIsEditingAcc(false);
    if (!window.getDropboxAccessToken || !window.getDropboxAccessToken()) return;
    try {
      await window.dropboxUploadFile(ACCUMULATOR_PATH, accOutput || ' ');
      accFlashStatus('Edits saved');
    } catch {
      alert('Failed to save edits');
    }
  };

  const accCopyAll = async () => {
    if (!accOutput.trim()) return;
    try {
      await navigator.clipboard.writeText(accOutput);
      accFlashStatus('Copied all');
    } catch {
      alert('Failed to copy.');
    }
  };

  const accClear = async () => {
    if (!window.getDropboxAccessToken || !window.getDropboxAccessToken()) return;
    try {
      await window.dropboxUploadFile(ACCUMULATOR_PATH, ' ');
      setAccOutput('');
      accFlashStatus('Cleared');
    } catch {
      alert('Failed to clear accumulator');
    }
  };

  return (
    <div className="App">
      {toastMessage && <div className="toast-notification">{toastMessage}</div>}
      {isMobile && (
        <button className="gear-button" onClick={() => setShowMobileMenu(true)} title="More tools & actions">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      )}

      {showMobileMenu && (
        <div className="mobile-menu-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowMobileMenu(false); }}>
          <div className="mobile-menu-panel">
            <div className="mobile-menu-header">
              <span>Tools & Actions</span>
              <button className="mobile-menu-close" onClick={() => setShowMobileMenu(false)}>&times;</button>
            </div>

            <div className="mobile-menu-section-title">Tools</div>
            <div className="mobile-menu-grid">
              <a href="/accumulator" className="mobile-menu-item">Clipboard Accumulator</a>
              <a href="/saved_text" className="mobile-menu-item">Saved Text</a>
              <a href="/images" className="mobile-menu-item">Clip Images</a>
              <a href="/screenshots" className="mobile-menu-item">Screenshots</a>
              <a href="/paths" className="mobile-menu-item">Path Links</a>
              <a href="/qr_bridge" className="mobile-menu-item">QR Bridge</a>
              <a href="/splitter" className="mobile-menu-item">Text Splitter</a>
              <a href="/youtube_timestamp_parse" className="mobile-menu-item">YouTube Timestamp</a>
            </div>

            <div className="mobile-menu-section-title">Actions</div>
            <div className="mobile-menu-actions">
              <button onClick={() => { pasteFromClipboard(); setShowMobileMenu(false); }}>Paste from Clipboard</button>
              <button onClick={() => { setTextboxContent(savedContent); setShowMobileMenu(false); }}>Paste from Saved</button>
              <button onClick={() => { append(); setShowMobileMenu(false); }}>Append</button>
              <label className="mobile-menu-toggle">
                <span>Auto Save</span>
                <div className={`toggle-switch ${autoSave ? 'active' : ''}`} onClick={() => setAutoSave(!autoSave)}>
                  <div className="toggle-knob" />
                </div>
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="container">
        <h1>Clipboard Manager</h1>

        <div className="tools-section">
          <a href="/accumulator" className="tool-link">
            <span className="tool-name">Clipboard Accumulator</span>
            <span className="tool-desc">Append clipboard snippets into a single scrollable collection you can copy or download.</span>
          </a>
          <a href="/saved_text" className="tool-link">
            <span className="tool-name">Saved Text</span>
            <span className="tool-desc">Search and copy saved text notes from Dropbox by name or folder.</span>
          </a>
          <a href="/images" className="tool-link">
            <span className="tool-name">Clip Images</span>
            <span className="tool-desc">Upload images from your phone and view them on your laptop. 5 replaceable slots.</span>
          </a>
          <a href="/screenshots" className="tool-link">
            <span className="tool-name">Screenshots</span>
            <span className="tool-desc">Search Dropbox screenshots by name. Click to view in modal with left/right navigation.</span>
          </a>
          <a href="/paths" className="tool-link">
            <span className="tool-name">Path Links</span>
            <span className="tool-desc">Quick access to filesystem paths. Type a number or search by label to copy.</span>
          </a>
          <a href="/qr_bridge" className="tool-link">
            <span className="tool-name">QR Bridge</span>
            <span className="tool-desc">Generate QR codes from text or URLs. Scan to view content instantly.</span>
          </a>
          <div className="tool-dropdown">
            <button className="tool-dropdown-toggle" onClick={(e) => {
              e.currentTarget.parentElement.classList.toggle('open');
            }}>More Tools ▾</button>
            <div className="tool-dropdown-menu">
              <a href="/splitter" className="tool-link">
                <span className="tool-name">Text Splitter</span>
                <span className="tool-desc">Split markdown or structured text into individual sections and download each as a .txt file.</span>
              </a>
              <a href="/youtube_timestamp_parse" className="tool-link">
                <span className="tool-name">YouTube Timestamp</span>
                <span className="tool-desc">Paste a YouTube URL with a timestamp to extract and copy the time in seconds.</span>
              </a>
            </div>
          </div>
        </div>
        <p className="tools-hint">Prompting is to divide the chat into subtopics.</p>

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
          {!isMobile && (
            <button onClick={pasteFromClipboard} className="paste-button">
              Paste from Clipboard
            </button>
          )}
          {!isMobile && (
            <button onClick={() => setTextboxContent(savedContent)} className="paste-button">
              Paste from Saved
            </button>
          )}
          <button onClick={save} className="save-button" disabled={saveStatus === 'saving'}>
            {isMobile && saveStatus === 'saving' ? 'Saving…' : 'Save'}
          </button>
          {!isMobile && (
            <button onClick={append} className="save-button">
              Append
            </button>
          )}
          <button
            onClick={() =>
              dbxSignedIn ? loadFromDropbox() : (window.dropboxSignIn && window.dropboxSignIn())
            }
            onContextMenu={(e) => {
              if (dbxSignedIn) {
                e.preventDefault();
                handleDropboxSignOut();
              }
            }}
            className="dropbox-button"
            title={dbxSignedIn ? 'Click to load. Right-click to sign out.' : 'Sign in to Dropbox'}
          >
            {dbxSignedIn ? (isMobile ? 'Dropbox ✓' : 'DB: Load') : (isMobile ? 'Sign in to Dropbox' : 'DB: Sign In')}
          </button>
        </div>
        {saveStatus === 'saved' && (
          <div className="save-status-banner">✓ Saved to Dropbox</div>
        )}

        {savedContent && (
          <div className="saved-section">
            <div className="saved-content" onClick={async () => {
              await loadFromDropbox();
              await new Promise(r => setTimeout(r, 200));
              showToast('Copied to clipboard!');
            }} style={{ cursor: 'pointer' }}>{savedContent}</div>
            <div className="saved-actions">
              <button onClick={loadFromDropbox} className="go-link-button">
                Refresh
              </button>
              <button onClick={copyToClipboard} className="copy-button">
                Copy to Clipboard
              </button>
              <button onClick={goToLink} className="go-link-button">
                Go to Link
              </button>
            </div>
          </div>
        )}

        <div className="accumulator-section">
          <div className="accumulator-header">
            <h2>Accumulator</h2>
            <div className="accumulator-header-buttons">
              {!isEditingAcc ? (
                <button className="shortcuts-btn" style={{ background: '#3b82f6' }} onClick={() => setIsEditingAcc(true)}>Edit</button>
              ) : (
                <button className="shortcuts-btn" style={{ background: '#10b981' }} onClick={accSaveEdits}>Done</button>
              )}
              <button className="shortcuts-btn refresh-btn" onClick={accLoad}>Refresh</button>
            </div>
          </div>
          {isEditingAcc ? (
            <textarea
              className="accumulator-output"
              value={accOutput}
              onChange={(e) => setAccOutput(e.target.value)}
              onBlur={accSaveEdits}
              placeholder="Edit accumulated text..."
              rows="8"
              autoFocus
            />
          ) : (
            <div className="saved-content accumulator-display" onClick={accCopyAll} style={{ cursor: 'pointer' }}>
              {accOutput || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No accumulated text yet. Type in the textbox above and click Save to append.</span>}
            </div>
          )}
          <div className="accumulator-actions">
            <button className="acc-copy-all" onClick={accCopyAll}>Copy All</button>
            <button className="acc-clear-btn" onClick={accClear}>Clear</button>
            {accStatus && <span className="acc-status">{accStatus}</span>}
          </div>
        </div>

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
            onChange={(e) => { handlePromptSelect(e.target.value, e.target.options[e.target.selectedIndex].text); e.target.value = ''; }}
          >
            <option value="" disabled>Select a prompt to copy...</option>
            {promptFiles.map((f) => (
              <option key={f.path} value={f.path}>{f.name}</option>
            ))}
          </select>
          {promptContent && (
            <div className="prompt-ready">
              <span className="prompt-ready-name">{promptName}</span>
              <button onClick={handleCopyPrompt} className="shortcuts-btn copy-prompt-btn">
                Copy to Clipboard
              </button>
            </div>
          )}
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
