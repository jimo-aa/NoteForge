// NoteForge — Extension Type Definitions
// Types for TipTap extensions, slash commands, and plugin API.

import type { Editor } from '@tiptap/react';
import type { Extensions } from '@tiptap/react';

/** Slash command item shown in the slash menu */
export interface SlashCommandItem {
  id: string;
  title: string;
  desc: string;
  /** Category for grouping in the slash menu UI */
  category?: 'heading' | 'format' | 'block' | 'media' | 'advanced' | 'custom';
  /** Execute the command on the given editor instance */
  execute: (editor: Editor) => void;
}

/** Descriptor for a registered editor extension */
export interface EditorExtensionDescriptor {
  id: string;
  name: string;
  version: string;
  description?: string;
  /** Dependencies on other extension IDs */
  dependencies?: string[];
  /** TipTap extension instances */
  extensions: Extensions;
}

/** Types of extensions by loading phase */
export type ExtensionPhase = 'core' | 'builtin' | 'lazy';
