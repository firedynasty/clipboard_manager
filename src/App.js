import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

function App() {
  const [textboxContent, setTextboxContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [qrVisible, setQrVisible] = useState(false);
  const qrRef = useRef(null);
  const [autoSave, setAutoSave] = useState(false);
  const autoSaveTimer = useRef(null);

  useEffect(() => {
    fetch('/api/files')
      .then((res) => res.json())
      .then((data) => {
        if (data.files) {
          if (data.files['saved-content.txt']) {
            setSavedContent(data.files['saved-content.txt']);
          }
        }
      })
      .catch(() => {});
  }, []);

  const saveContent = useCallback(async (content, { silent = false } = {}) => {
    if (content.trim()) {
      setSavedContent(content);
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: 'saved-content.txt',
          content: content,
        }),
      });
      if (!response.ok) {
        if (!silent) {
          throw new Error('Failed to save');
        }
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
        alert('Failed to save to server');
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
        alert('Failed to append to server');
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

  return (
    <div className="App">
      <div className="container">
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
            <button onClick={copyToClipboard} className="copy-button">
              Copy to Clipboard
            </button>
          </div>
        )}

        <div className="qr-section">
          <h2>QR Code</h2>
          <button onClick={generateQR} className="qr-button">
            Generate QR Code
          </button>
          {qrVisible && (
            <div className="qr-output">
              <div ref={qrRef}></div>
              <p className="qr-hint">Scan to view and copy content on any device</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
