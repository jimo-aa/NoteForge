import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface Slide {
  title: string;
  description: string;
}

export function WelcomeGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const slides: Slide[] = useMemo(() => [
    { title: t('welcome.page1Title'), description: t('welcome.page1Desc') },
    { title: t('welcome.page2Title'), description: t('welcome.page2Desc') },
    { title: t('welcome.page3Title'), description: t('welcome.page3Desc') },
    { title: t('welcome.page4Title'), description: t('welcome.page4Desc') },
    { title: t('welcome.page5Title'), description: t('welcome.page5Desc') },
  ], [t]);

  if (!open) return null;

  const slide = slides[currentSlide]!;
  const isLast = currentSlide === slides.length - 1;
  const isFirst = currentSlide === 0;

  const handleClose = () => {
    if (dontShowAgain) {
      try { window.localStorage.setItem('noteforge:welcome:completed', '1'); } catch { /* localStorage may be unavailable */ }
    }
    onClose();
    setCurrentSlide(0);
  };

  const handleNext = () => {
    if (isLast) {
      handleClose();
    } else {
      setCurrentSlide((p) => p + 1);
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal welcome-guide-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2>{slide.title}</h2>
          <button className="modal-close" onClick={handleClose}>&times;</button>
        </div>
        <div className="modal-content-large" style={{ minHeight: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 32px' }}>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#555', whiteSpace: 'pre-wrap' }}>{slide.description}</p>
        </div>
        <div style={{ padding: '16px 32px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: '#999', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={dontShowAgain} onChange={(e) => setDontShowAgain(e.target.checked)} />
            {t('welcome.dontShowAgain')}
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: '#999' }}>{t('welcome.slideCounter', { current: currentSlide + 1, total: slides.length })}</div>
            {!isFirst && (
              <button className="ghost-btn" onClick={() => setCurrentSlide((p) => p - 1)}>{t('welcome.prev')}</button>
            )}
            <button className="primary-btn" onClick={handleNext}>
              {isLast ? t('welcome.finish') : t('welcome.next')} &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
