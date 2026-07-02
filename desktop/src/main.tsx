import React from 'react';
import ReactDOM from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { NoteProvider } from '@/stores/context';
import { AuthProvider } from '@/stores/authStore';
import i18n from '@/i18n';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <NoteProvider>
          <App />
        </NoteProvider>
      </AuthProvider>
    </I18nextProvider>
  </React.StrictMode>,
);
