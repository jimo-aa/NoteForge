import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoteList } from '@/components/Sidebar/NoteList';

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
  selectNote: vi.fn(),
  setContextMenu: vi.fn(),
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
  selectNote: vi.fn(), setContextMenu: vi.fn(),
};

describe('NoteList', () => {
  it('renders empty state when no notes', () => {
    mockUseStore.mockReturnValue(emptyStore);
    render(<NoteList />);
    expect(screen.getByText('暂无笔记')).toBeInTheDocument();
  });

  it('renders notes when available', () => {
    mockUseStore.mockReturnValue(noteStore);
    render(<NoteList />);
    expect(screen.getByText('Test Note')).toBeInTheDocument();
  });
});
