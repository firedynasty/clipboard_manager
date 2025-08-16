import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue } from 'firebase/database';
import CryptoJS from 'crypto-js';

const firebaseConfig = {
  apiKey: "AIzaSyB0_4AT0jzRoSeV5jK4rN4Ah7BTKKTl78I",
  authDomain: "linked-in-creators.firebaseapp.com",
  databaseURL: "https://linked-in-creators-default-rtdb.firebaseio.com",
  projectId: "linked-in-creators",
  storageBucket: "linked-in-creators.appspot.com",
  messagingSenderId: "282570385061",
  appId: "1:282570385061:web:24fcf17921e99540984f4c",
  measurementId: "G-5G6JG8VERG"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function App() {
  const [lastClipboardItem, setLastClipboardItem] = useState(null);
  const [textboxContent, setTextboxContent] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [escapeMode, setEscapeMode] = useState('copy');
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedImageSlot, setSelectedImageSlot] = useState(1);

  useEffect(() => {
    const dbRef = ref(database, 'clipboardManager/lastItem');
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setLastClipboardItem(data);
        
        // For real-time updates, show raw data in textbox (user can manually decrypt with Load button)
        setTextboxContent(data);
      } else {
        setLastClipboardItem(null);
        setTextboxContent('');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);


  const copyToClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setLastClipboardItem(text);
        setTextboxContent(text);
        await set(ref(database, 'clipboardManager/lastItem'), text);
      }
    } catch (error) {
      console.error('Error copying from clipboard:', error);
      alert('Failed to access clipboard. Please allow clipboard permissions.');
    }
  }, []);

  const saveTextboxToFirebase = async () => {
    try {
      if (textboxContent.trim()) {
        let dataToStore = textboxContent;
        
        // Encrypt if key is provided
        if (encryptionKey.trim()) {
          dataToStore = CryptoJS.AES.encrypt(textboxContent, encryptionKey).toString();
          alert('Data encrypted and saved to Firebase!');
        } else {
          alert('Data saved to Firebase (no encryption)!');
        }
        
        setLastClipboardItem(dataToStore);
        await set(ref(database, 'clipboardManager/lastItem'), dataToStore);
      }
    } catch (error) {
      console.error('Error saving to Firebase:', error);
      alert('Failed to save to Firebase');
    }
  };

  const loadFromFirebase = async () => {
    try {
      const dbRef = ref(database, 'clipboardManager/lastItem');
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        setLastClipboardItem(data);
        
        let finalText = '';
        
        // Try to decrypt if key is provided
        if (encryptionKey.trim()) {
          try {
            const decryptedBytes = CryptoJS.AES.decrypt(data, encryptionKey);
            const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
            
            if (decryptedText) {
              setTextboxContent(decryptedText);
              finalText = decryptedText;
              alert('Data decrypted and loaded from Firebase!');
            } else {
              setTextboxContent(data);
              finalText = data;
              alert('❌ Wrong encryption key! Showing raw encrypted data.');
            }
          } catch (error) {
            setTextboxContent(data);
            finalText = data;
            alert('❌ Decryption failed! Showing raw encrypted data.');
          }
        } else {
          setTextboxContent(data);
          finalText = data;
          alert('Loaded from Firebase (no decryption)!');
        }
        
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(finalText);
          console.log('Content also copied to clipboard');
        } catch (clipboardError) {
          console.error('Failed to copy to clipboard:', clipboardError);
        }
      } else {
        alert('No data found in Firebase');
      }
    } catch (error) {
      console.error('Error loading from Firebase:', error);
      alert('Failed to load from Firebase');
    }
  };

  const clearItem = async () => {
    if (window.confirm('Are you sure you want to clear the clipboard item?')) {
      try {
        await set(ref(database, 'clipboardManager/lastItem'), null);
        setLastClipboardItem(null);
        setTextboxContent('');
      } catch (error) {
        console.error('Error clearing data:', error);
      }
    }
  };

  const uploadImageToCloudinary = async () => {
    if (!selectedImage) {
      alert('Please select an image first');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedImage);
    formData.append('upload_preset', process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);
    formData.append('cloud_name', process.env.REACT_APP_CLOUDINARY_CLOUD_NAME);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();
      
      if (response.ok) {
        const cloudinaryUrl = data.secure_url;
        setImageUrl(cloudinaryUrl);
        
        // Store the Cloudinary URL in Firebase
        await set(ref(database, `clipboardManager/lastImage${selectedImageSlot}`), cloudinaryUrl);
        alert('Image uploaded to Cloudinary and URL saved to Firebase!');
      } else {
        console.error('Upload failed:', data);
        alert('Upload failed: ' + (data.error?.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Error uploading image: ' + error.message);
    }
  };

  const loadImageFromFirebase = async () => {
    try {
      const dbRef = ref(database, `clipboardManager/lastImage${selectedImageSlot}`);
      const snapshot = await get(dbRef);
      
      if (snapshot.exists()) {
        const url = snapshot.val();
        setImageUrl(url);
        alert('Image URL loaded from Firebase!');
      } else {
        alert('No image URL found in Firebase');
      }
    } catch (error) {
      console.error('Error loading image URL:', error);
      alert('Failed to load image URL from Firebase');
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setSelectedImagePreview(previewUrl);
    }
  };

  const copyItemToClipboard = useCallback(async () => {
    if (!lastClipboardItem) {
      alert('No item to copy');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(lastClipboardItem);
      alert('Item copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert('Failed to copy to clipboard');
    }
  }, [lastClipboardItem]);

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (escapeMode === 'insert') {
          copyToClipboard();
        } else if (escapeMode === 'copy') {
          copyItemToClipboard();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [escapeMode, copyToClipboard, copyItemToClipboard]);

  if (isLoading) {
    return (
      <div className="App">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Clipboard Manager</h1>
        
        <div className="textbox-section">
          <input
            type="text"
            value={encryptionKey}
            onChange={(e) => setEncryptionKey(e.target.value)}
            placeholder="Encryption key (leave blank for no encryption)"
            style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
          />
          <textarea 
            value={textboxContent}
            onChange={(e) => setTextboxContent(e.target.value)}
            placeholder="Enter or edit text here..."
            rows="4"
            style={{ width: '100%', marginBottom: '10px' }}
          />
          <button onClick={saveTextboxToFirebase} className="save-button">
            💾 Save to Firebase
          </button>
          &nbsp;
          <button onClick={loadFromFirebase} className="load-button">
            📥 Load from Firebase
          </button>
        </div>

        <div className="image-section" style={{ marginTop: '20px' }}>
          <h3>Image Upload</h3>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            style={{ marginBottom: '10px' }}
          />
          <br />
          <div style={{ marginBottom: '10px' }}>
            <span>Select slot: </span>
            {[1, 2, 3, 4, 5].map(slot => (
              <label key={slot} style={{ marginRight: '10px' }}>
                <input
                  type="radio"
                  value={slot}
                  checked={selectedImageSlot === slot}
                  onChange={(e) => setSelectedImageSlot(parseInt(e.target.value))}
                />
                {slot}
              </label>
            ))}
          </div>
          <button onClick={uploadImageToCloudinary} className="upload-button">
            📤 Save to Cloudinary
          </button>
          &nbsp;
          <button onClick={loadImageFromFirebase} className="load-image-button">
            📥 Load from Cloudinary
          </button>
          
          {selectedImagePreview && (
            <div style={{ marginTop: '20px' }}>
              <p>Selected Image Preview:</p>
              <img 
                src={selectedImagePreview} 
                alt="Selected preview" 
                style={{ width: '100%', maxHeight: '500px', objectFit: 'contain', border: '1px solid #ccc' }}
              />
            </div>
          )}
          
          {imageUrl && (
            <div style={{ marginTop: '20px' }}>
              <p>Current Image:</p>
              <img 
                src={imageUrl} 
                alt="Uploaded" 
                style={{ width: '100%', maxHeight: '500px', objectFit: 'contain', border: '1px solid #ccc', cursor: 'pointer' }}
                onClick={() => navigator.clipboard.writeText(imageUrl)}
                title="Click to copy URL to clipboard"
              />
              <p style={{ fontSize: '12px', color: '#666' }}>
                Click image to copy URL to clipboard
              </p>
            </div>
          )}
        </div>
        
        <div className="controls">
          <button onClick={copyToClipboard} className="copy-button">
            📋 Insert from Clipboard
          </button>
          <div className="escape-mode-controls">
            <span>Escape key action:</span>
            <label>
              <input
                type="radio"
                value="insert"
                checked={escapeMode === 'insert'}
                onChange={(e) => setEscapeMode(e.target.value)}
              />
              Insert
            </label>
            <label>
              <input
                type="radio"
                value="copy"
                checked={escapeMode === 'copy'}
                onChange={(e) => setEscapeMode(e.target.value)}
              />
              Copy
            </label>
          </div>
          {lastClipboardItem && (
            <>
              <button onClick={copyItemToClipboard} className="copy-last-button">
                📋 Copy Item
              </button>
              <button onClick={clearItem} className="clear-button">
                🗑️ Clear Item
              </button>
            </>
          )}
        </div>
      </header>
      
      <main className="clipboard-content">
        {!lastClipboardItem ? (
          <div className="empty-state">
            <p>No clipboard item yet</p>
            <p>Click "Insert from Clipboard" to add an item</p>
          </div>
        ) : (
          <div className="item-container">
            <div className="clipboard-item" onClick={copyItemToClipboard}>
              <div className="content-text">{lastClipboardItem}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;