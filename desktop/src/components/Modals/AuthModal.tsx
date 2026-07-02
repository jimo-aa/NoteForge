// NoteForge — 登录/注册模态框

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/stores/authStore';

type AuthTab = 'login' | 'register';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { t } = useTranslation();
  const { login, register, isLoading } = useAuth();
  const [tab, setTab] = useState<AuthTab>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const resetForm = () => {
    setLoginEmail('');
    setPassword('');
    setRegisterName('');
    setRegisterEmail('');
    setRegisterPassword('');
    setConfirmPassword('');
    setError('');
  };

  const switchTab = (next: AuthTab) => {
    setTab(next);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (tab === 'login') {
      if (!loginEmail.trim()) { setError(t('auth.error_required')); return; }
      if (!password) { setError(t('auth.error_required')); return; }

      const result = await login(loginEmail.trim(), password);
      if (result.success) {
        resetForm();
        onClose();
      } else {
        setError(result.message || t('auth.error_invalid'));
      }
    } else {
      if (!registerName.trim()) { setError(t('auth.error_required')); return; }
      if (!registerEmail.trim()) { setError(t('auth.error_required')); return; }
      if (!registerPassword) { setError(t('auth.error_required')); return; }
      if (registerPassword.length < 6) { setError(t('auth.error_required')); return; }
      if (registerPassword !== confirmPassword) { setError(t('auth.error_passwordMismatch')); return; }

      const result = await register(registerName.trim(), registerEmail.trim(), registerPassword);
      if (result.success) {
        resetForm();
        onClose();
      } else {
        setError(result.message || t('auth.error_invalid'));
      }
    }
  };

  return createPortal(
    <div className="modal-backdrop auth-backdrop" onClick={onClose}>
      <div className="modal auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h3>{tab === 'login' ? t('auth.login') : t('auth.register')}</h3>
          <button className="modal-close" onClick={onClose} type="button" aria-label={t('common.close')}>✕</button>
        </div>

        <div className="modal-tabs">
          <button className={tab === 'login' ? 'modal-tab active' : 'modal-tab'} onClick={() => switchTab('login')}>{t('auth.login')}</button>
          <button className={tab === 'register' ? 'modal-tab active' : 'modal-tab'} onClick={() => switchTab('register')}>{t('auth.register')}</button>
        </div>

        <form className="auth-modal-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          {tab === 'login' && (
            <>
              <label className="auth-field">
                <span>{t('auth.email')}</span>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder={t('auth.email')}
                  autoFocus
                  disabled={isLoading}
                />
              </label>
              <label className="auth-field">
                <span>{t('auth.password')}</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.password')}
                  disabled={isLoading}
                />
              </label>
            </>
          )}

          {tab === 'register' && (
            <>
              <label className="auth-field">
                <span>{t('auth.username')}</span>
                <input
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder={t('auth.username')}
                  autoFocus
                  disabled={isLoading}
                />
              </label>
              <label className="auth-field">
                <span>{t('auth.email')}</span>
                <input
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder={t('auth.email')}
                  disabled={isLoading}
                />
              </label>
              <label className="auth-field">
                <span>{t('auth.password')}</span>
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder={t('auth.password')}
                  disabled={isLoading}
                />
              </label>
              <label className="auth-field">
                <span>{t('auth.confirmPassword')}</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.confirmPassword')}
                  disabled={isLoading}
                />
              </label>
            </>
          )}

          <div className="auth-modal-actions">
            <button className="ghost-btn" type="button" onClick={onClose} disabled={isLoading}>{t('common.cancel')}</button>
            <button className="primary-btn" type="submit" disabled={isLoading}>
              {isLoading ? t('common.loading') : tab === 'login' ? t('auth.loginBtn') : t('auth.registerBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
