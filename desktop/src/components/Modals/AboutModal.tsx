import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

const APP_VERSION = '0.1.0';

export function AboutModal({ open, onClose }: AboutModalProps) {
  const { t } = useTranslation();

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>{t('about.title')}</h2>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>×</button>
        </div>
        <div className="modal-content" style={{ padding: '24px 32px' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent, #6a63ff)' }}>NoteForge</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
              {t('about.version')} {APP_VERSION}
            </div>
            <div style={{ fontSize: 13, color: '#666', marginTop: 8, lineHeight: 1.5 }}>
              {t('about.description')}
            </div>
          </div>

          <h4 style={{ marginBottom: 8 }}>{t('about.techStack')}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, marginBottom: 20 }}>
            <div><strong>{t('about.desktop')}:</strong> Tauri 2 + React 18 + Rust</div>
            <div><strong>{t('about.web')}:</strong> Next.js 15 (planned)</div>
            <div><strong>{t('about.mobile')}:</strong> Flutter 3 (planned)</div>
            <div><strong>{t('about.backend')}:</strong> Java 21 + Spring Boot 3</div>
            <div style={{ gridColumn: '1 / -1' }}><strong>{t('about.coreEngine')}:</strong> Rust (Tantivy + libgit2 + AES-256-GCM)</div>
          </div>

          <h4 style={{ marginBottom: 8 }}>{t('about.feedback')}</h4>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12, lineHeight: 1.5 }}>
            {t('about.feedbackDesc')}
          </p>
          <a
            href="https://github.com/openclaw/NoteForge/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="primary-btn"
            style={{ display: 'inline-block', textDecoration: 'none', fontSize: 13 }}
          >
            {t('about.githubIssue')}
          </a>
        </div>
        <div className="modal-actions" style={{ padding: '12px 32px', justifyContent: 'flex-end' }}>
          <button className="ghost-btn" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
