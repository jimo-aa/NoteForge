// NoteForge — 登录/注册模态框

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/stores/authStore';

type AuthTab = 'login' | 'register';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
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
      if (!loginEmail.trim()) { setError('请输入邮箱'); return; }
      if (!password) { setError('请输入密码'); return; }

      const result = await login(loginEmail.trim(), password);
      if (result.success) {
        resetForm();
        onClose();
      } else {
        setError(result.message || '登录失败');
      }
    } else {
      if (!registerName.trim()) { setError('请输入昵称'); return; }
      if (!registerEmail.trim()) { setError('请输入邮箱'); return; }
      if (!registerPassword) { setError('请输入密码'); return; }
      if (registerPassword.length < 6) { setError('密码至少6个字符'); return; }
      if (registerPassword !== confirmPassword) { setError('两次密码输入不一致'); return; }

      const result = await register(registerName.trim(), registerEmail.trim(), registerPassword);
      if (result.success) {
        resetForm();
        onClose();
      } else {
        setError(result.message || '注册失败');
      }
    }
  };

  return createPortal(
    <div className="modal-backdrop auth-backdrop" onClick={onClose}>
      <div className="modal auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h3>{tab === 'login' ? '登录' : '注册'}</h3>
          <button className="modal-close" onClick={onClose} type="button" aria-label="关闭">✕</button>
        </div>

        <div className="modal-tabs">
          <button className={tab === 'login' ? 'modal-tab active' : 'modal-tab'} onClick={() => switchTab('login')}>登录</button>
          <button className={tab === 'register' ? 'modal-tab active' : 'modal-tab'} onClick={() => switchTab('register')}>注册</button>
        </div>

        <form className="auth-modal-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          {tab === 'login' && (
            <>
              <label className="auth-field">
                <span>邮箱</span>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="输入邮箱地址"
                  autoFocus
                  disabled={isLoading}
                />
              </label>
              <label className="auth-field">
                <span>密码</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="输入密码"
                  disabled={isLoading}
                />
              </label>
            </>
          )}

          {tab === 'register' && (
            <>
              <label className="auth-field">
                <span>昵称</span>
                <input
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="输入昵称"
                  autoFocus
                  disabled={isLoading}
                />
              </label>
              <label className="auth-field">
                <span>邮箱</span>
                <input
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="输入邮箱地址"
                  disabled={isLoading}
                />
              </label>
              <label className="auth-field">
                <span>密码</span>
                <input
                  type="password"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="输入密码（至少6位）"
                  disabled={isLoading}
                />
              </label>
              <label className="auth-field">
                <span>确认密码</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  disabled={isLoading}
                />
              </label>
            </>
          )}

          <div className="auth-modal-actions">
            <button className="ghost-btn" type="button" onClick={onClose} disabled={isLoading}>取消</button>
            <button className="primary-btn" type="submit" disabled={isLoading}>
              {isLoading ? '处理中...' : tab === 'login' ? '登录' : '注册'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
