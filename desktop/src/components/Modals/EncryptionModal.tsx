import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { tauriInvoke } from '@/utils/invoke';

interface EncryptionModalProps {
  open: boolean;
  onClose: () => void;
}

type EncryptionState = 'loading' | 'setup' | 'unlock' | 'enabled' | 'error';

export function EncryptionModal({ open, onClose }: EncryptionModalProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<EncryptionState>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const checkStatus = useCallback(async () => {
    setState('loading');
    setError('');
    try {
      const hasStored = await tauriInvoke<boolean>('has_stored_encryption');
      if (hasStored) {
        // 已有加密设置，进入解锁模式
        setState('unlock');
      } else {
        // 未设置加密，进入设置模式
        setState('setup');
      }
    } catch {
      setState('error');
      setError(t('encryptionExtra.statusCheckFailed'));
    }
  }, [t]);

  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmPassword('');
      setError('');
      void checkStatus();
    }
  }, [open, checkStatus]);

  const handleEnable = async () => {
    setError('');
    if (!password) { setError(t('encryptionExtra.enterPassword')); return; }
    if (password.length < 6) { setError(t('encryptionExtra.passwordMinLength')); return; }
    if (password !== confirmPassword) { setError(t('encryptionExtra.passwordMismatch')); return; }

    setIsProcessing(true);
    try {
      const salt = await tauriInvoke<string>('init_encryption', { password });
      if (salt) {
        setState('enabled');
        setPassword('');
        setConfirmPassword('');
      } else {
        setError(t('encryptionExtra.initFailed'));
      }
    } catch (e) {
      setError(t('encryptionExtra.encryptFailed', { error: String(e) }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlock = async () => {
    setError('');
    if (!password) { setError(t('encryptionExtra.enterPassword')); return; }

    setIsProcessing(true);
    try {
      const ok = await tauriInvoke<boolean>('try_unlock_encryption', { password });
      if (ok) {
        setState('enabled');
        setPassword('');
      } else {
        setError(t('encryptionExtra.verifyFailed'));
      }
    } catch (e) {
      setError(t('encryptionExtra.decryptFailed', { error: String(e) }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisable = async () => {
    setIsProcessing(true);
    try {
      await tauriInvoke<void>('disable_encryption');
      setState('setup');
      setPassword('');
    } catch (e) {
      setError(t('encryptionExtra.disableFailed', { error: String(e) }));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return <div className="encryption-loading">{t('encryptionExtra.loading')}</div>;

      case 'setup':
        return (
          <div className="encryption-setup">
            <div className="encryption-info">
              <span className="encryption-icon">🔓</span>
              <span>{t('encryptionExtra.setupDesc')}</span>
            </div>
            <label className="auth-field">
              <span>{t('encryptionExtra.setPassword')}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('encryptionExtra.passwordHint')}
                autoFocus
                disabled={isProcessing}
              />
            </label>
            <label className="auth-field">
              <span>{t('encryption.confirmPassword')}</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('encryptionExtra.confirmPasswordHint')}
                disabled={isProcessing}
              />
            </label>
            <button className="primary-btn" onClick={handleEnable} disabled={isProcessing} style={{ width: '100%', marginTop: 4 }}>
              {isProcessing ? t('encryptionExtra.processing') : t('encryptionExtra.enableBtn')}
            </button>
          </div>
        );

      case 'unlock':
        return (
          <div className="encryption-setup">
            <div className="encryption-info">
              <span className="encryption-icon">🔐</span>
              <span>{t('encryptionExtra.unlockDesc')}</span>
            </div>
            <label className="auth-field">
              <span>{t('encryptionExtra.unlockTitle')}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('encryptionExtra.unlockHint')}
                autoFocus
                disabled={isProcessing}
              />
            </label>
            <button className="primary-btn" onClick={handleUnlock} disabled={isProcessing} style={{ width: '100%', marginTop: 4 }}>
              {isProcessing ? t('encryptionExtra.processingUnlock') : t('encryptionExtra.unlockBtn')}
            </button>
          </div>
        );

      case 'enabled':
        return (
          <div className="encryption-enabled">
            <div className="encryption-info">
              <span className="encryption-icon">🔐</span>
              <span>{t('encryptionExtra.enabledDesc')}</span>
            </div>
            <div className="encryption-badge">{t('encryptionExtra.unlocked')}</div>
            <div className="encryption-actions">
              <button className="danger-btn" onClick={handleDisable} disabled={isProcessing} style={{ width: '100%' }}>
                {isProcessing ? t('encryptionExtra.processingDisable') : t('encryptionExtra.disableBtn')}
              </button>
            </div>
            <p className="encryption-note">{t('encryptionExtra.disableNote')}</p>
          </div>
        );

      case 'error':
        return (
          <div className="encryption-setup">
            <div className="encryption-info">
              <span className="encryption-icon">⚠️</span>
              <span>{t('encryptionExtra.statusCheckDesc')}</span>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="primary-btn" onClick={checkStatus} style={{ width: '100%', marginTop: 4 }}>
              {t('encryptionExtra.retry')}
            </button>
          </div>
        );
    }
  };

  return createPortal(
    <div className="modal-backdrop auth-backdrop" onClick={onClose}>
      <div className="modal auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h3>{t('encryption.title')}</h3>
          <button className="modal-close" onClick={onClose} type="button" aria-label={t('common.close')}>✕</button>
        </div>
        <div className="auth-modal-form">
          {error && <div className="auth-error">{error}</div>}
          {renderContent()}
        </div>
      </div>
    </div>,
    document.body
  );
}
