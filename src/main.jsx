import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

if (window.vkBridge) {
  window.vkBridge.send('VKWebAppInit').catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
