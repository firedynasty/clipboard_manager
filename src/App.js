import React, { useState } from 'react';
import './App.css';

function App() {
  const [message, setMessage] = useState('');

  const handleClick = () => {
    setMessage('Hello World!');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Basic Vercel App</h1>
        <button onClick={handleClick} className="hello-button">
          Click me!
        </button>
        {message && <p className="message">{message}</p>}
      </header>
    </div>
  );
}

export default App;