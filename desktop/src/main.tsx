import React from 'react';
import ReactDOM from 'react-dom/client';
import { NoteProvider } from '@/stores/context';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <NoteProvider>
      <App />
    </NoteProvider>
  </React.StrictMode>,
);
