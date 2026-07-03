// NoteForge — AI Writing Toolbar
// Floating toolbar that appears when user selects text in the editor.
// Provides: Continue, Rewrite, Translate, Complete actions with streaming.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as aiService from '@/services/aiService';
import type { AiStreamCallbacks } from '@/services/aiService';

interface AIToolbarProps {
  /** Selected text from the editor */
  selectedText: string;
  /** Full note content for context */
  noteContent: string;
  /** Position to anchor the toolbar (relative to editor container) */
  position: { top: number; left: number } | null;
  /** Called with AI-generated content to insert/replace in the editor */
  onInsert: (content: string, mode: 'replace' | 'append' | 'insertBelow') => void;
  /** Close the toolbar */
  onClose: () => void;
  /** Whether the toolbar is visible */
  visible: boolean;
}

type AiAction = 'continue' | 'rewrite' | 'translate' | 'complete' | null;

type StreamState = {
  action: AiAction;
  fullContent: string;
  /** Current streaming text being built */
  displayText: string;
};

const TONE_OPTIONS = [
  { value: 'clear', labelKey: 'ai.toneClear' },
  { value: 'professional', labelKey: 'ai.toneProfessional' },
  { value: 'academic', labelKey: 'ai.toneAcademic' },
  { value: 'simple', labelKey: 'ai.toneSimple' },
  { value: 'creative', labelKey: 'ai.toneCreative' },
] as const;

const LANG_OPTIONS = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'fr', label: 'Français' },
] as const;

export function AIToolbar({
  selectedText,
  noteContent,
  position,
  onInsert,
  onClose,
  visible,
}: AIToolbarProps) {
  const { t } = useTranslation();
  const [streamState, setStreamState] = useState<StreamState | null>(null);
  const [tone, setTone] = useState('clear');
  const [targetLang, setTargetLang] = useState('zh-CN');
  const [showTonePicker, setShowTonePicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Cancel streaming on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to prevent immediate close from the same click
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClick); };
  }, [visible, onClose]);

  const startStream = useCallback((action: AiAction) => {
    if (!selectedText) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreamState({ action, fullContent: '', displayText: '' });

    const callbacks: AiStreamCallbacks = {
      onDelta: (content) => {
        setStreamState((prev) => prev ? { ...prev, displayText: prev.displayText + content, fullContent: prev.fullContent + content } : prev);
      },
      onDone: (fullContent) => {
        setStreamState((prev) => prev ? { ...prev, displayText: fullContent, fullContent } : null);
        // Auto-insert on completion
        handleInsert(fullContent, action);
      },
      onError: (error) => {
        setStreamState(null);
        console.error('[AI] Stream error:', error);
      },
    };

    switch (action) {
      case 'continue':
        void aiService.continueText(selectedText, noteContent, callbacks, controller.signal);
        break;
      case 'rewrite':
        void aiService.rewriteText(selectedText, tone, callbacks, controller.signal);
        break;
      case 'translate':
        void aiService.translateText(selectedText, targetLang, callbacks, controller.signal);
        break;
      case 'complete':
        void aiService.completeText(selectedText, callbacks, controller.signal);
        break;
    }
  }, [selectedText, noteContent, tone, targetLang]);

  const handleInsert = (content: string, action: AiAction) => {
    if (!content) return;
    switch (action) {
      case 'rewrite':
        onInsert(content, 'replace');
        break;
      case 'translate':
        onInsert(content, 'insertBelow');
        break;
      case 'continue':
      case 'complete':
      default:
        onInsert(content, 'append');
        break;
    }
  };

  const cancelStream = () => {
    abortRef.current?.abort();
    // If we have partial content, insert it
    if (streamState?.displayText && streamState.action) {
      handleInsert(streamState.displayText, streamState.action);
    }
    setStreamState(null);
  };

  if (!visible) return null;

  const toolbarStyle: React.CSSProperties = position
    ? { position: 'absolute', top: position.top - 48, left: position.left, zIndex: 1000 }
    : {};

  return (
    <div
      ref={toolbarRef}
      className="ai-toolbar"
      style={toolbarStyle}
      onMouseDown={(e) => e.preventDefault()}
    >
      {streamState ? (
        <div className="ai-toolbar__streaming">
          <div className="ai-toolbar__streaming-content">
            <span className="ai-toolbar__spinner" />
            <span className="ai-toolbar__label">
              {streamState.action === 'continue' && t('ai.continuing')}
              {streamState.action === 'rewrite' && t('ai.rewriting')}
              {streamState.action === 'translate' && t('ai.translating')}
              {streamState.action === 'complete' && t('ai.completing')}
            </span>
          </div>
          {streamState.displayText && (
            <div className="ai-toolbar__preview">
              {streamState.displayText.slice(0, 200)}
              {streamState.displayText.length > 200 ? '...' : ''}
            </div>
          )}
          <button className="ai-toolbar__cancel" onClick={cancelStream} title={t('ai.cancel')}>
            ✕
          </button>
        </div>
      ) : (
        <div className="ai-toolbar__actions">
          <button
            className="ai-toolbar__btn"
            onClick={() => startStream('continue')}
            title={t('ai.continueHint')}
          >
            <span className="ai-toolbar__icon">✍</span> {t('ai.continue')}
          </button>

          <div className="ai-toolbar__group">
            <button
              className="ai-toolbar__btn"
              onClick={() => setShowTonePicker(!showTonePicker)}
              title={t('ai.rewriteHint')}
            >
              <span className="ai-toolbar__icon">✏</span> {t('ai.rewrite')}
            </button>
            {showTonePicker && (
              <div className="ai-toolbar__dropdown">
                {TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`ai-toolbar__dropdown-item ${tone === opt.value ? 'ai-toolbar__dropdown-item--active' : ''}`}
                    onClick={() => { setTone(opt.value); setShowTonePicker(false); startStream('rewrite'); }}
                  >
                    {t(opt.labelKey)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ai-toolbar__group">
            <button
              className="ai-toolbar__btn"
              onClick={() => setShowLangPicker(!showLangPicker)}
              title={t('ai.translateHint')}
            >
              <span className="ai-toolbar__icon">🌐</span> {t('ai.translate')}
            </button>
            {showLangPicker && (
              <div className="ai-toolbar__dropdown">
                {LANG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`ai-toolbar__dropdown-item ${targetLang === opt.value ? 'ai-toolbar__dropdown-item--active' : ''}`}
                    onClick={() => { setTargetLang(opt.value); setShowLangPicker(false); startStream('translate'); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className="ai-toolbar__btn"
            onClick={() => startStream('complete')}
            title={t('ai.completeHint')}
          >
            <span className="ai-toolbar__icon">→</span> {t('ai.complete')}
          </button>

          <button className="ai-toolbar__close" onClick={onClose}>✕</button>
        </div>
      )}
    </div>
  );
}
