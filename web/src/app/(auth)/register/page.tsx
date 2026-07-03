'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password) { setError(t('auth.required')); return; }
    if (password.length < 6) { setError(t('auth.passwordMinLength')); return; }
    const result = await register(name, email, password);
    if (result.success) router.push('/notes');
    else setError(result.message || t('auth.registerFailed'));
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>NoteForge</h2>
        <p>{t('auth.registerTitle')}</p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>{t('auth.name')}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('auth.namePlaceholder')} autoFocus />
          </div>
          <div className="auth-field">
            <label>{t('auth.email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div className="auth-field">
            <label>{t('auth.password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          </div>
          <button className="primary-btn" type="submit" disabled={isLoading}>
            {isLoading ? t('auth.registering') : t('auth.register')}
          </button>
        </form>
        <div className="auth-link">
          {t('auth.hasAccount')} <Link href="/login">{t('auth.login')}</Link>
        </div>
      </div>
    </div>
  );
}
