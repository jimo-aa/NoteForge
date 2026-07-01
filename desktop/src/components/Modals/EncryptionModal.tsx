// NoteForge — 加密设置模态框（桌面端端到端加密）

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { tauriInvoke } from '@/utils/invoke';

interface EncryptionModalProps {
  open: boolean;
  onClose: () => void;
}

type EncryptionState = 'loading' | 'disabled' | 'enabled' | 'error';

export function EncryptionModal({ open, onClose }: EncryptionModalProps) {
  const [state, setState] = useState<EncryptionState>('loading');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const checkStatus = useCallback(async () => {
    setState('loading');
    try {
      const enabled = await tauriInvoke<boolean>('is_encryption_enabled');
      setState(enabled ? 'enabled' : 'disabled');
    } catch {
      setState('error');
      setError('无法检测加密状态');
    }
  }, []);

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
    if (!password) { setError('请输入加密密码'); return; }
    if (password.length < 6) { setError('密码至少6个字符'); return; }
    if (password !== confirmPassword) { setError('两次密码输入不一致'); return; }

    setIsProcessing(true);
    try {
      const salt = await tauriInvoke<string>('init_encryption', { password });
      if (salt) {
        setState('enabled');
        setPassword('');
        setConfirmPassword('');
      } else {
        setError('加密初始化失败');
      }
    } catch (e) {
      setError(`加密失败: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlock = async () => {
    setError('');
    if (!password) { setError('请输入加密密码'); return; }

    setIsProcessing(true);
    try {
      const salt = await tauriInvoke<string>('init_encryption', { password });
      if (salt) {
        setState('enabled');
        setPassword('');
      } else {
        setError('密码验证失败');
      }
    } catch (e) {
      setError(`解密失败: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisable = async () => {
    setIsProcessing(true);
    try {
      await tauriInvoke<void>('disable_encryption');
      setState('disabled');
      setPassword('');
    } catch (e) {
      setError(`禁用加密失败: ${e}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return <div className="encryption-loading">检测加密状态…</div>;

      case 'disabled':
        return (
          <div className="encryption-setup">
            <div className="encryption-info">
              <span className="encryption-icon">🔓</span>
              <span>当前数据未加密。启用后，笔记内容将在本地使用 AES-256-GCM 加密存储。</span>
            </div>
            <label className="auth-field">
              <span>设置加密密码</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码（至少6位）"
                autoFocus
                disabled={isProcessing}
              />
            </label>
            <label className="auth-field">
              <span>确认密码</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                disabled={isProcessing}
              />
            </label>
            <button className="primary-btn" onClick={handleEnable} disabled={isProcessing} style={{ width: '100%', marginTop: 4 }}>
              {isProcessing ? '初始化中…' : '启用加密'}
            </button>
          </div>
        );

      case 'enabled':
        return (
          <div className="encryption-enabled">
            <div className="encryption-info">
              <span className="encryption-icon">🔐</span>
              <span>端到端加密已启用。笔记内容使用 AES-256-GCM 加密存储。</span>
            </div>
            <div className="encryption-badge">加密已激活</div>
            <div className="encryption-actions">
              <button className="danger-btn" onClick={handleDisable} disabled={isProcessing} style={{ width: '100%' }}>
                {isProcessing ? '处理中…' : '禁用加密'}
              </button>
            </div>
            <p className="encryption-note">禁用加密将解密所有笔记数据。此操作不可撤销。</p>
          </div>
        );

      case 'error':
        return (
          <div className="encryption-setup">
            <div className="encryption-info">
              <span className="encryption-icon">⚠️</span>
              <span>无法检测加密状态，请确认应用已正确初始化。</span>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="primary-btn" onClick={checkStatus} style={{ width: '100%', marginTop: 4 }}>
              重试
            </button>
          </div>
        );
    }
  };

  return createPortal(
    <div className="modal-backdrop auth-backdrop" onClick={onClose}>
      <div className="modal auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h3>端到端加密</h3>
          <button className="modal-close" onClick={onClose} type="button" aria-label="关闭">✕</button>
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
