import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get } from 'firebase/database';

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
  const [clipboardItems, setClipboardItems] = useState([]);
  const [nextId, setNextId] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [escapeMode, setEscapeMode] = useState('copy');

  useEffect(() => {
    loadFromFirebase();
  }, []);

  const loadFromFirebase = async () => {
    try {
      const dbRef = ref(database, 'clipboardManager/');
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        const items = Object.entries(data).map(([key, value]) => ({
          id: parseInt(key),
          content: value
        }));
        setClipboardItems(items.sort((a, b) => a.id - b.id));
        setNextId(Math.max(...items.map(item => item.id)) + 1);
      }
    } catch (error) {
      console.error('Error loading from Firebase:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        const newItem = {
          id: nextId,
          content: text
        };
        
        const newItems = [...clipboardItems, newItem];
        setClipboardItems(newItems);
        setNextId(nextId + 1);
        
        await set(ref(database, `clipboardManager/${nextId}`), text);
      }
    } catch (error) {
      console.error('Error copying from clipboard:', error);
      alert('Failed to access clipboard. Please allow clipboard permissions.');
    }
  }, [clipboardItems, nextId]);

  const clearAll = async () => {
    if (window.confirm('Are you sure you want to clear all clipboard items?')) {
      try {
        await set(ref(database, 'clipboardManager/'), null);
        setClipboardItems([]);
        setNextId(1);
      } catch (error) {
        console.error('Error clearing data:', error);
      }
    }
  };

  const deleteItem = async (id) => {
    try {
      await set(ref(database, `clipboardManager/${id}`), null);
      setClipboardItems(clipboardItems.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const copyItemToClipboard = useCallback(async (item) => {
    try {
      await navigator.clipboard.writeText(item.content);
      alert(`Item ${item.id} copied to clipboard!`);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert('Failed to copy to clipboard');
    }
  }, []);

  const copyLastItemToClipboard = useCallback(async () => {
    if (clipboardItems.length === 0) {
      alert('No items in table to copy');
      return;
    }
    
    try {
      const lastItem = clipboardItems[clipboardItems.length - 1];
      await navigator.clipboard.writeText(lastItem.content);
      alert('Last item copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      alert('Failed to copy to clipboard');
    }
  }, [clipboardItems]);

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (escapeMode === 'insert') {
          copyToClipboard();
        } else if (escapeMode === 'copy') {
          copyLastItemToClipboard();
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [escapeMode, copyToClipboard, copyLastItemToClipboard]);

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
        <div className="controls">
          <button onClick={copyToClipboard} className="copy-button">
            📋 Insert from Clipboard
          </button>
          <div className="stats">
            Items in table: {clipboardItems.length}
          </div>
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
          {clipboardItems.length > 0 && (
            <>
              <button onClick={copyLastItemToClipboard} className="copy-last-button">
                📋 Copy Last Item
              </button>
              <button onClick={clearAll} className="clear-button">
                🗑️ Clear All
              </button>
            </>
          )}
        </div>
      </header>
      
      <main className="clipboard-content">
        {clipboardItems.length === 0 ? (
          <div className="empty-state">
            <p>No clipboard items yet</p>
            <p>Click "Insert from Clipboard" to add your first item</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="clipboard-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Content</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {clipboardItems.map((item) => (
                  <tr key={item.id} onClick={() => copyItemToClipboard(item)} className="clickable-row">
                    <td className="id-cell">{item.id}</td>
                    <td className="content-cell">
                      <div className="content-text">{item.content}</div>
                    </td>
                    <td className="actions-cell">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteItem(item.id);
                        }}
                        className="delete-button"
                        title="Delete item"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;