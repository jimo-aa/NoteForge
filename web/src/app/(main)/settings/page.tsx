'use client';

import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>{t('manage.title')}</h2>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, padding: 24, maxWidth: 480 }}>
        <div className="auth-field">
          <label>{t('auth.name')}</label>
          <div style={{ padding: '10px 0', fontSize: 15 }}>{user?.username}</div>
        </div>
        <div className="auth-field">
          <label>{t('auth.email')}</label>
          <div style={{ padding: '10px 0', fontSize: 15 }}>{user?.email}</div>
        </div>
        <button className="primary-btn" onClick={logout} style={{ marginTop: 16, background: '#ff4444' }}>
          {t('sidebar.login')}
        </button>
      </div>
    </div>
  );
}
