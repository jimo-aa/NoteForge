// NoteForge — Main Editor Component (Legacy Wrapper)
// Now delegates to EditorContainer — the new decomposed architecture.
// This file exists for backward compatibility with App.tsx import path.
//
// The new architecture:
//   EditorContainer (top coordinator)
//   ├─ EditorToolbar       — formatting toolbar
//   ├─ EditorTabs          — tag tabs
//   ├─ DocumentHeader      — title + actions
//   ├─ StatusBar           — save status + stats
//   ├─ WysiwygEditor       — TipTap editor
//   ├─ SourceEditor        — CodeMirror 6 editor
//   ├─ AIToolbar           — AI assistant
//   └─ AttachmentPanel     — file attachments

export { EditorContainer as Editor } from './EditorContainer';
