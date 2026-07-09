// NoteForge — 自绘 SVG 图标集
// 所有图标均为 24×24 viewBox, stroke 2px, 纯 inline SVG 组件
// 优先使用此图标集替代 emoji 或外部图片

import type { FC, SVGProps } from 'react';

export type IconBaseProps = SVGProps<SVGSVGElement> & { size?: number; title?: string };

function baseProps(props: IconBaseProps, defSize = 18): SVGProps<SVGSVGElement> {
  const { size, title, ...svgProps } = props;
  const s = size ?? defSize;
  const result: SVGProps<SVGSVGElement> & { title?: string } = {
    width: s,
    height: s,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...svgProps,
  };
  if (title) result.title = title;
  return result;
}

// ── 应用 / 品牌 ──

export const NoteForgeLogo: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props, 22)}>
    {/* Stylized N+F mark — crossed quill + hexagon hint */}
    <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" strokeWidth="1.8" />
    <path d="M9 8v8" strokeWidth="1.8" />
    <path d="M12 8l-3 4 3 4" strokeWidth="1.8" />
    <path d="M15 8v8" strokeWidth="1.8" />
  </svg>
);

// ── 笔记 / 文档 ──

export const NoteIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

export const NotebookIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <line x1="8" y1="7" x2="16" y2="7" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

export const AllNotesIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);

// ── 文件夹 ──

export const FolderIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export const FolderOpenIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <path d="M6 21l-2-8h16l-2 8" />
  </svg>
);

// ── 方向指示 ──

export const ChevronDownIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const ChevronRightIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

// ── 主题 ──

export const SunIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

export const MoonIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

// ── 操作 ──

export const PlusIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const SearchIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const GearIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const InfoIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

export const LogoutIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

export const DraftIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

export const SyncIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export const PinIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M12 2a6 6 0 0 0-6 6c0 3 2 5.5 6 8 4-2.5 6-5 6-8a6 6 0 0 0-6-6z" />
    <circle cx="12" cy="8" r="2" />
  </svg>
);

export const StarIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export const RecentIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const TagIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

export const GraphIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <circle cx="12" cy="12" r="3" />
    <circle cx="19" cy="5" r="2" />
    <circle cx="5" cy="5" r="2" />
    <circle cx="5" cy="19" r="2" />
    <circle cx="19" cy="19" r="2" />
    <line x1="12" y1="12" x2="19" y2="5" />
    <line x1="12" y1="12" x2="5" y2="5" />
    <line x1="12" y1="12" x2="5" y2="19" />
    <line x1="12" y1="12" x2="19" y2="19" />
  </svg>
);

export const FilterIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

export const CollapseLeftIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <polyline points="13 9 10 12 13 15" />
  </svg>
);

export const ExpandRightIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="15" y1="3" x2="15" y2="21" />
    <polyline points="11 9 14 12 11 15" />
  </svg>
);

export const CheckIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const CloseIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const MenuIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

export const CloudIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" />
  </svg>
);

export const CloudOffIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export const UserIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const DragHandleIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);

export const CalendarIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export const LightbulbIcon: FC<IconBaseProps> = (props) => (
  <svg {...baseProps(props)}>
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
  </svg>
);

// ── Icon type map ──
// 供 Icon.tsx 统一引用

export const iconComponentMap = {
  'all-notes': AllNotesIcon,
  notebook: NotebookIcon,
  note: NoteIcon,
  folder: FolderIcon,
  'folder-open': FolderOpenIcon,
  search: SearchIcon,
  plus: PlusIcon,
  sun: SunIcon,
  moon: MoonIcon,
  graph: GraphIcon,
  gear: GearIcon,
  info: InfoIcon,
  logout: LogoutIcon,
  draft: DraftIcon,
  sync: SyncIcon,
  pin: PinIcon,
  star: StarIcon,
  recent: RecentIcon,
  tag: TagIcon,
  filter: FilterIcon,
  calendar: CalendarIcon,
  lightbulb: LightbulbIcon,
  'chevron-down': ChevronDownIcon,
  'chevron-right': ChevronRightIcon,
  'collapse-left': CollapseLeftIcon,
  'expand-right': ExpandRightIcon,
  check: CheckIcon,
  close: CloseIcon,
  menu: MenuIcon,
  cloud: CloudIcon,
  'cloud-off': CloudOffIcon,
  user: UserIcon,
  'drag-handle': DragHandleIcon,
  logo: NoteForgeLogo,
} as const;

export type SvgIconType = keyof typeof iconComponentMap;
