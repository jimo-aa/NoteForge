import type { NoteStore } from '@/stores/noteStore';
import type { Note } from '@/types';

export function TagsBar({ note, store }: { note: Note; store: NoteStore }) {
  const removeTag = (tag: string) => {
    const newTags = note.meta.tags.filter(t => t !== tag);
    store.updateNote(note.meta.id, { tags: newTags });
  };

  return (
    <div className="tags-bar">
      {note.meta.tags.map(tag => (
        <span key={tag} className="tag-pill">
          {tag}
          <span className="remove" onClick={() => removeTag(tag)}>×</span>
        </span>
      ))}
      <button className="add-tag-btn" onClick={() => {
        const name = prompt('输入标签名称:');
        if (name && !note.meta.tags.includes(name)) {
          store.updateNote(note.meta.id, { tags: [...note.meta.tags, name] });
        }
      }}>+ 添加标签</button>
    </div>
  );
}
