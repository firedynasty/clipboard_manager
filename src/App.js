import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [textboxContent, setTextboxContent] = useState('');
  const [savedContent, setSavedContent] = useState('');

  useEffect(() => {
    fetch('/api/files')
      .then((res) => res.json())
      .then((data) => {
        if (data.files && data.files['saved-content.txt']) {
          setSavedContent(data.files['saved-content.txt']);
        }
      })
      .catch(() => {});
  }, []);

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
      setSavedContent(textboxContent);
      try {
        await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: 'saved-content.txt',
            content: textboxContent,
          }),
        });
      } catch (error) {
        alert('Failed to save to server');
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

  return (
    <div className="App">
      <div className="container">
        <h1>Clipboard Manager</h1>

        <textarea
          value={textboxContent}
          onChange={(e) => setTextboxContent(e.target.value)}
          placeholder="Paste or type text here..."
          rows="6"
        />

        <div className="buttons">
          <button onClick={pasteFromClipboard} className="paste-button">
            Paste from Clipboard
          </button>
          <button onClick={save} className="save-button">
            Save
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
      </div>
    </div>
  );
}

export default App;
