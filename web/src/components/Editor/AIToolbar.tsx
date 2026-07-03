'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as aiService from '@/lib/ai-service';
import type { AiStreamCallbacks } from '@/lib/ai-service';

interface AIToolbarProps {
  selectedText: string; noteContent: string;
  position: { top: number; left: number } | null;
  onInsert: (content: string, mode: 'replace' | 'append' | 'insertBelow') => void;
  onClose: () => void; visible: boolean;
}

type AiAction = 'continue' | 'rewrite' | 'translate' | 'complete' | null;
type StreamState = { action: AiAction; fullContent: string; displayText: string };

const TONES = [
  { value: 'clear', label: 'Clear' }, { value: 'professional', label: 'Professional' },
  { value: 'academic', label: 'Academic' }, { value: 'simple', label: 'Simple' }, { value: 'creative', label: 'Creative' },
];
const LANGS = [
  { value: 'zh-CN', label: '中文' }, { value: 'en-US', label: 'English' },
  { value: 'ja', label: '日本語' }, { value: 'ko', label: '한국어' },
];

export function AIToolbar({ selectedText, noteContent, onInsert, onClose, visible }: AIToolbarProps) {
  const { t } = useTranslation();
  const [streamState, setStreamState] = useState<StreamState | null>(null);
  const [tone, setTone] = useState('clear');
  const [targetLang, setTargetLang] = useState('zh-CN');
  const [showTone, setShowTone] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { return () => abortRef.current?.abort(); }, []);
  useEffect(() => {
    if (!visible) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const t = setTimeout(() => document.addEventListener('click', h), 0);
    return () => { clearTimeout(t); document.removeEventListener('click', h); };
  }, [visible, onClose]);

  const start = useCallback((action: AiAction) => {
    if (!selectedText) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreamState({ action, fullContent: '', displayText: '' });
    const cb: AiStreamCallbacks = {
      onDelta: (c) => setStreamState((p) => p ? { ...p, displayText: p.displayText + c, fullContent: p.fullContent + c } : p),
      onDone: (c) => { setStreamState((p) => p ? { ...p, displayText: c, fullContent: c } : null); handleInsert(c, action); },
      onError: () => setStreamState(null),
    };
    if (action === 'continue') void aiService.continueText(selectedText, noteContent, cb, ctrl.signal);
    else if (action === 'rewrite') void aiService.rewriteText(selectedText, tone, cb, ctrl.signal);
    else if (action === 'translate') void aiService.translateText(selectedText, targetLang, cb, ctrl.signal);
    else if (action === 'complete') void aiService.completeText(selectedText, cb, ctrl.signal);
  }, [selectedText, noteContent, tone, targetLang]);

  const handleInsert = (content: string, action: AiAction) => {
    if (!content) return;
    onInsert(content, action === 'rewrite' ? 'replace' : action === 'translate' ? 'insertBelow' : 'append');
  };

  const cancel = () => {
    abortRef.current?.abort();
    if (streamState?.displayText && streamState.action) handleInsert(streamState.displayText, streamState.action);
    setStreamState(null);
  };

  if (!visible) return null;

  return (
    <div ref={ref} className="ai-toolbar" style={{ position: 'absolute', top: -48, left: 10, zIndex: 1000 }}>
      {streamState ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px' }}>
          <span style={{ fontSize: 12, color: 'var(--accent)' }}>AI writing...</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{streamState.displayText.slice(0, 100)}</span>
          <button onClick={cancel} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 4, padding: '4px 8px', alignItems: 'center' }}>
          <ToolBtn onClick={() => start('continue')}>✍ Continue</ToolBtn>
          <div style={{ position: 'relative' }}>
            <ToolBtn onClick={() => setShowTone(!showTone)}>✏ Rewrite</ToolBtn>
            {showTone && <Dropdown items={TONES.map(t => ({ label: t.label, onClick: () => { setTone(t.value); setShowTone(false); start('rewrite'); } }))} />}
          </div>
          <div style={{ position: 'relative' }}>
            <ToolBtn onClick={() => setShowLang(!showLang)}>🌐 Translate</ToolBtn>
            {showLang && <Dropdown items={LANGS.map(l => ({ label: l.label, onClick: () => { setTargetLang(l.value); setShowLang(false); start('translate'); } }))} />}
          </div>
          <ToolBtn onClick={() => start('complete')}>→ Complete</ToolBtn>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>✕</button>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ padding: '4px 10px', border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--text-soft)', cursor: 'pointer', fontSize: 12 }}>{children}</button>;
}

function Dropdown({ items }: { items: { label: string; onClick: () => void }[] }) {
  return <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--panel-2)', border: '1px solid var(--line-strong)', borderRadius: 8, padding: 4, minWidth: 140, zIndex: 1001 }}>{items.map((item, i) => <button key={i} onClick={item.onClick} style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', borderRadius: 5, background: 'transparent', color: 'var(--text-soft)', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>{item.label}</button>)}</div>;
}
