import React, { useState } from 'react';
import './App.css';

function App() {
  const [textboxContent, setTextboxContent] = useState('');
  const [savedContent, setSavedContent] = useState('');

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setTextboxContent(text);
    } catch (error) {
      alert('Failed to read from clipboard');
    }
  };

  const save = () => {
    if (textboxContent.trim()) {
      setSavedContent(textboxContent);
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
