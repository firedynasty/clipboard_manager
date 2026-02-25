import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';

function App() {
  const [textboxContent, setTextboxContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
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

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
    }
  };

  const saveImage = async () => {
    if (!selectedImage) {
      alert('Please select an image first');
      return;
    }

    const filename = selectedImage.name.replace(/\.[^/.]+$/, '');
    const publicId = `clipboard/${filename}`;

    const formData = new FormData();
    formData.append('file', selectedImage);
    formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);
    formData.append('cloud_name', process.env.REACT_APP_CLOUDINARY_CLOUD_NAME);
    formData.append('public_id', publicId);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );

      const data = await response.json();

      if (response.ok) {
        const cloudinaryUrl = data.secure_url;
        setImageUrl(cloudinaryUrl);

        await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: 'image-url.txt',
            content: cloudinaryUrl,
          }),
        });
        alert('Image uploaded and URL saved!');
      } else {
        alert('Upload failed: ' + (data.error?.message || 'Unknown error'));
      }
    } catch (error) {
      alert('Error uploading image: ' + error.message);
    }
  };

  const loadImage = async () => {
    try {
      const response = await fetch('/api/files');
      const data = await response.json();
      if (data.files && data.files['image-url.txt']) {
        setImageUrl(data.files['image-url.txt']);
      } else {
        alert('No saved image URL found');
      }
    } catch (error) {
      alert('Failed to load image URL');
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

        <div className="image-section">
          <h2>Image</h2>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
          />
          <div className="buttons">
            <button onClick={saveImage} className="save-button">
              Save Image
            </button>
            <button onClick={loadImage} className="paste-button">
              Load Image
            </button>
          </div>

          {imageUrl && (
            <div className="image-preview">
              <p>Saved Image:</p>
              <img
                src={imageUrl}
                alt="Saved"
                onClick={() => {
                  navigator.clipboard.writeText(imageUrl);
                  alert('Image URL copied!');
                }}
                title="Click to copy URL"
              />
              <p className="image-url-hint">Click image to copy URL</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
