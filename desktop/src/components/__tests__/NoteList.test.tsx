import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoteList } from '@/components/Sidebar/NoteList';

// Mock i18n: return the key itself so tests can assert on translation keys
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { mockUseStore } = vi.hoisted(() => ({
  mockUseStore: vi.fn(),
}));

vi.mock('@/stores/context', () => ({
  useStore: mockUseStore,
}));

vi.mock('@/components/Common/Icon', () => ({
  Icon: ({ type }: { type: string }) => <span data-testid={`icon-${type}`} />,
}));

const emptyStore = {
  filteredNotes: [],
  searchQuery: '',
  currentNoteId: null,
  selectedNoteIds: [],
  lastSavedAt: null,
  notebooks: [],
  selectNote: vi.fn(),
  setContextMenu: vi.fn(),
  selectAllFiltered: vi.fn(),
  clearSelection: vi.fn(),
};

const noteStore = {
  filteredNotes: [
    {
      meta: {
        id: '1', title: 'Test Note', notebookId: null, tags: ['test'],
        isPinned: false, isFavorite: false, wordCount: 10, version: 1,
        createdAt: 1000, updatedAt: 1000,
      },
      content: 'Hello world', contentPlain: 'Hello world',
    },
  ],
  searchQuery: '', currentNoteId: null, selectedNoteIds: [], lastSavedAt: null,
  notebooks: [],
  selectNote: vi.fn(),
  setContextMenu: vi.fn(),
  selectAllFiltered: vi.fn(),
  clearSelection: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NoteList', () => {
  it('renders empty state when no notes', () => {
    mockUseStore.mockReturnValue(emptyStore);
    render(<NoteList />);
    // Component uses t('noteList.emptyTitle') which returns the key itself when mocked
    expect(screen.getByText('noteList.emptyTitle')).toBeInTheDocument();
  });

  it('renders batch toolbar when notes available', () => {
    mockUseStore.mockReturnValue(noteStore);
    render(<NoteList />);
    // Virtualizer may not render items in jsdom, but the non-empty path
    // always shows the batch-select-all bar
    expect(screen.getByText('sidebar.selectAll')).toBeInTheDocument();
  });
});
