# NoteForge — React Component Tree

## OVERVIEW

28 files (4825 lines) across 5 subdirectories — all React 18 components for the Tauri desktop app.

## STRUCTURE

```
components/
├── Modals/       # 11 modal dialogs: note/notebook CRUD, version control, diff viewer, manage, milestone, draft recovery, export/backup, advanced features
├── Common/       # 6 shared components + 7 SVG icons: Icon, Toast, ConfirmDialog, ContextMenu, ErrorBoundary, GraphView (knowledge graph)
├── Sidebar/      # 4 files: Sidebar, NoteList, NavSection, SearchBox
├── Editor/       # 3 files: Editor, CodeMirrorEditor, EditorWithAdvancedFeatures
└── Features/     # 2 files + CSS: AdvancedVersioningPanel, AdvancedVersioningToolbar
```

## WHERE TO LOOK

| Task | File |
|------|------|
| Note CRUD | `Modals/NewNoteModal.tsx`, `Modals/NotebookModal.tsx`, `Modals/EntityModal.tsx` |
| Versioning | `Modals/VersionControlModal.tsx`, `Features/AdvancedVersioning*.tsx` |
| Editor | `Editor/Editor.tsx`, `Editor/CodeMirrorEditor.tsx` |
| Knowledge graph | `Common/GraphView.tsx` |
| Navigation | `Sidebar/Sidebar.tsx`, `Sidebar/NoteList.tsx` |
| Search | `Sidebar/SearchBox.tsx` |

## CONVENTIONS

- One component per file, PascalCase filename matching export
- Modals follow `XxxModal.tsx` naming
- CSS is vanilla (globals.css) + CSS modules for feature-specific styles (`.module.css`)
- Props typed inline or via local interface, rarely extracted to shared types
- ErrorBoundary pattern already established in Common/

## ANTI-PATTERNS

- No barrel exports — each consumer imports directly from component path
- No shared component library — UI primitives are recreated per modal
