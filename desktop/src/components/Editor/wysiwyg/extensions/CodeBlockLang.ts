// NoteForge — Code Block Language Selector Extension
// Adds a language label + dropdown to code blocks in WYSIWYG mode.
// The language attribute on the code block is used for syntax highlighting.

import { Extension } from '@tiptap/core';

/** Supported code languages for the selector dropdown */
export const CODE_LANGUAGES = [
  { label: 'Plain Text', value: '' },
  { label: 'Markdown', value: 'markdown' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Python', value: 'python' },
  { label: 'Rust', value: 'rust' },
  { label: 'Go', value: 'go' },
  { label: 'Java', value: 'java' },
  { label: 'Kotlin', value: 'kotlin' },
  { label: 'Swift', value: 'swift' },
  { label: 'C', value: 'c' },
  { label: 'C++', value: 'cpp' },
  { label: 'C#', value: 'csharp' },
  { label: 'Ruby', value: 'ruby' },
  { label: 'PHP', value: 'php' },
  { label: 'Bash', value: 'bash' },
  { label: 'PowerShell', value: 'powershell' },
  { label: 'SQL', value: 'sql' },
  { label: 'HTML', value: 'html' },
  { label: 'CSS', value: 'css' },
  { label: 'SCSS', value: 'scss' },
  { label: 'Less', value: 'less' },
  { label: 'YAML', value: 'yaml' },
  { label: 'JSON', value: 'json' },
  { label: 'XML', value: 'xml' },
  { label: 'TOML', value: 'toml' },
  { label: 'Dockerfile', value: 'dockerfile' },
  { label: 'GraphQL', value: 'graphql' },
  { label: 'Protobuf', value: 'protobuf' },
  { label: 'Diff', value: 'diff' },
];

/** Code block language extension */
export const CodeBlockLang = Extension.create({
  name: 'codeBlockLang',

  addOptions() {
    return {
      languages: CODE_LANGUAGES,
    };
  },
});
