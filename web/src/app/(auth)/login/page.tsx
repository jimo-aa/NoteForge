'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError(t('auth.required')); return; }
    const result = await login(email, password);
    if (result.success) router.push('/notes');
    else setError(result.message || t('auth.loginFailed'));
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>NoteForge</h2>
        <p>{t('auth.loginTitle')}</p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>{t('auth.email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" autoFocus />
          </div>
          <div className="auth-field">
            <label>{t('auth.password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          </div>
          <button className="primary-btn" type="submit" disabled={isLoading}>
            {isLoading ? t('auth.loggingIn') : t('auth.login')}
          </button>
        </form>
        <div className="auth-link">
          {t('auth.noAccount')} <Link href="/register">{t('auth.register')}</Link>
        </div>
      </div>
    </div>
  );
}
