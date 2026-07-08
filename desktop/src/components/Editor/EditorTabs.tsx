// NoteForge — Editor Tabs
// Tag tabs bar showing note tags with remove and add actions.
// Extracted from the legacy Editor.tsx.

import { useTranslation } from 'react-i18next';

interface EditorTabsProps {
  tags: string[];
  onRemoveTag: (tag: string) => void;
  onAddTag: () => void;
  onOpenVersionHistory: () => void;
}

export function EditorTabs({ tags, onRemoveTag, onAddTag, onOpenVersionHistory }: EditorTabsProps) {
  const { t } = useTranslation();

  return (
    <div className="editor-tabs">
      {tags.map((tag) => (
        <button
          key={tag}
          className="editor-tab"
          onClick={() => onRemoveTag(tag)}
          title={t('note.tagRemoveHint')}
        >
          <span>{tag}</span><span>×</span>
        </button>
      ))}
      <button className="editor-tab add" onClick={onAddTag}>
        {t('manage.tabTags')}
      </button>
      <button className="editor-tab add" onClick={onOpenVersionHistory}>
        ⏱ {t('version.title')}
      </button>
    </div>
  );
}
