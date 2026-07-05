import 'package:flutter/material.dart';

/// NoteForge icon system — single source of truth for ALL icons.
/// Replace emoji with Material vector icons for professional look.
class AppIcons {
  // Tab bar
  static const notes     = Icons.description_outlined;
  static const search    = Icons.search;
  static const notebooks = Icons.menu_book_outlined;
  static const favorites = Icons.star_outline;
  static const profile   = Icons.person_outline;

  // Navigation
  static const back      = Icons.arrow_back;
  static const close     = Icons.close;
  static const check     = Icons.check;
  static const add       = Icons.add;
  static const more      = Icons.more_vert;
  static const chevronRight = Icons.chevron_right;
  static const clear     = Icons.clear;

  // Actions
  static const edit      = Icons.edit_outlined;
  static const delete    = Icons.delete_outline;
  static const save      = Icons.check;
  static const sync      = Icons.sync;
  static const share     = Icons.ios_share;
  static const favorite  = Icons.star;
  static const favoriteBorder = Icons.star_border;
  static const pin       = Icons.push_pin;
  static const pinFilled = Icons.push_pin;
  static const upload    = Icons.file_upload_outlined;

  // Notes
  static const note      = Icons.description_outlined;
  static const noteAlt   = Icons.note_alt_outlined;
  static const book      = Icons.menu_book_outlined;
  static const flash     = Icons.bolt;
  static const target    = Icons.track_changes;
  static const tag       = Icons.label_outline;

  // Notebooks
  static const allNotes  = Icons.view_list;
  static const notebook  = Icons.menu_book_outlined;
  static const folder    = Icons.folder_outlined;

  // Profile
  static const person    = Icons.person;
  static const syncBackup = Icons.cloud_sync_outlined;
  static const theme     = Icons.palette_outlined;
  static const security  = Icons.lock_outlined;
  static const storage   = Icons.storage_outlined;
  static const feedback  = Icons.chat_bubble_outline;
  static const about     = Icons.info_outline;
  static const logout    = Icons.logout;

  // Theme
  static const lightMode = Icons.light_mode;
  static const darkMode  = Icons.dark_mode;
  static const systemMode = Icons.settings_remote_outlined;

  // Status
  static const empty     = Icons.inbox_outlined;
  static const star      = Icons.star;
  static const starBorder = Icons.star_border;

  // Format bar
  static const formatBold = Icons.format_bold;
  static const formatItalic = Icons.format_italic;
  static const formatStrikethrough = Icons.strikethrough_s;
  static const formatCode = Icons.code;
  static const formatHeading = Icons.title;
  static const formatList = Icons.format_list_bulleted;
  static const formatTodo = Icons.checklist;
  static const formatQuote = Icons.format_quote;

  // Misc
  static const ai       = Icons.auto_awesome;
  static const searchOff = Icons.search_off;

  // Notebook icon picker — 16 vector icons for user selection
  static const List<IconData> notebookIcons = [
    Icons.menu_book,
    Icons.book,
    Icons.library_books,
    Icons.auto_stories,
    Icons.note_alt,
    Icons.description,
    Icons.article,
    Icons.sticky_note_2,
    Icons.folder,
    Icons.folder_special,
    Icons.collections_bookmark,
    Icons.bookmark,
    Icons.computer,
    Icons.rocket_launch,
    Icons.autorenew,
    Icons.smart_toy,
  ];
}
