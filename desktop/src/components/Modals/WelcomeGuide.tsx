import { useState } from 'react';

interface Slide {
  title: string;
  description: string;
}

const slides: Slide[] = [
  {
    title: '欢迎使用 NoteForge',
    description: 'NoteForge 是一款全平台智能笔记系统，支持 Markdown 编辑、版本控制、云同步和知识图谱。让我们快速了解一下主要功能。',
  },
  {
    title: '创建与编辑笔记',
    description: '点击左侧「新建笔记」按钮创建笔记。编辑器支持完整的 Markdown 语法：标题、加粗、列表、代码块、表格、图片等。使用 [[Wiki Link]] 语法可以链接到其他笔记。',
  },
  {
    title: '笔记本与标签',
    description: '使用笔记本组织笔记分类，添加标签进行灵活筛选。右键笔记可以管理标签，在「管理」窗口中可以编辑笔记本和标签。',
  },
  {
    title: '版本控制',
    description: 'NoteForge 为每篇笔记自动管理版本历史。在编辑器中打开「版本控制」可以查看历史版本、创建分支、对比差异。修改笔记后建议手动创建版本快照。',
  },
  {
    title: '云同步',
    description: '登录账户后，笔记会自动同步到云端。支持离线编辑，联网后自动同步。首次使用请先在设置中登录或注册。',
  },
];

export function WelcomeGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

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
            不再显示
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: '#999' }}>{currentSlide + 1} / {slides.length}</div>
            {!isFirst && (
              <button className="ghost-btn" onClick={() => setCurrentSlide((p) => p - 1)}>上一步</button>
            )}
            <button className="primary-btn" onClick={handleNext}>
              {isLast ? '完成' : '下一步'} &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
