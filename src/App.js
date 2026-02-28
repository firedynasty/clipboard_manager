import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

const DROPBOX_PATH = '/blob_vercel_replacement/blob_clipboard_content.txt';

function App() {
  const [textboxContent, setTextboxContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [qrVisible, setQrVisible] = useState(false);
  const qrRef = useRef(null);
  const [autoSave, setAutoSave] = useState(false);
  const autoSaveTimer = useRef(null);
  const [dbxSignedIn, setDbxSignedIn] = useState(false);

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

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;
    const pad = 40;
    const labelHeight = 40;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width + pad * 2;
    exportCanvas.height = canvas.height + pad * 2 + labelHeight;
    const ctx = exportCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(canvas, pad, pad);
    ctx.fillStyle = '#1a1a18';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('QR Bridge', exportCanvas.width / 2, canvas.height + pad + labelHeight - 8);
    const link = document.createElement('a');
    link.download = 'qr-bridge.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  const goToLink = () => {
    const url = savedContent.trim();
    if (/^https?:\/\//i.test(url)) {
      window.open(url, '_blank', 'noopener');
    } else {
      alert('Saved content is not a valid URL');
    }
  };

  const generateQR = () => {
    const content = textboxContent.trim();
    if (!content) {
      alert('Please enter some text first');
      return;
    }

    const container = qrRef.current;
    container.innerHTML = '';

    const QRCode = window.QRCode;
    if (!QRCode) {
      alert('QR library not loaded');
      return;
    }

    // Encode content into a URL pointing to the QR Bridge viewer
    const bytes = new TextEncoder().encode(content);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    const encoded = btoa(binary);

    const baseURL = window.location.origin;
    const qrURL = baseURL + '/qr_bridge.html#' + encoded;

    if (qrURL.length > 3500) {
      alert('Content is too long for a QR code. Try shortening it.');
      return;
    }

    new QRCode(container, {
      text: qrURL,
      width: 220,
      height: 220,
      colorDark: '#1a1a18',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });

    setQrVisible(true);
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

        <div className="qr-section">
          <h2>QR Code</h2>
          <button onClick={generateQR} className="qr-button">
            Generate QR Code
          </button>
          <div className="qr-output" style={{ display: qrVisible ? 'flex' : 'none' }}>
            <div ref={qrRef}></div>
            <button onClick={downloadQR} className="save-png-button">
              Save PNG
            </button>
            <p className="qr-hint">Scan to view and copy content on any device</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
