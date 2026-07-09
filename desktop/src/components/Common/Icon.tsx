// NoteForge — Icon 组件
// 统一图标入口: 优先使用自绘 inline SVG（Icons.tsx），回退到外部 SVG 图片

import searchIcon from '../../../../assets/icon/search.svg';
import noteIcon from '../../../../assets/icon/note.svg';
import gudinIcon from '../../../../assets/icon/gudin.svg';
import shoucangIcon from '../../../../assets/icon/shoucang.svg';
import zuijinIcon from '../../../../assets/icon/zuijin.svg';
import shangchuIcon from '../../../../assets/icon/shanchu.svg';
import chongmingminIcon from '../../../../assets/icon/chongmingmin.svg';

import {
  iconComponentMap,
  type SvgIconType,
} from '@/components/Common/Icons';

export type IconType =
  | SvgIconType
  | 'search-img'
  | 'note-img'
  | 'gudin'
  | 'shoucang'
  | 'zuijin'
  | 'all'
  | 'pinned'
  | 'recent'
  | 'delete'
  | 'rename';

interface IconProps {
  type: IconType;
  className?: string;
  title?: string;
  size?: number;
}

/** Legacy icon map for external SVG img imports */
const legacyIconMap: Record<string, string> = {
  search: searchIcon,
  note: noteIcon,
  gudin: gudinIcon,
  shoucang: shoucangIcon,
  zuijin: zuijinIcon,
  all: shoucangIcon,
  pinned: gudinIcon,
  recent: zuijinIcon,
  delete: shangchuIcon,
  rename: chongmingminIcon,
};

export function Icon({ type, className = '', title, size }: IconProps) {
  // If type matches a modern inline SVG icon, render it directly
  if (type in iconComponentMap) {
    const SvgIcon = iconComponentMap[type as SvgIconType];
    return (
      <SvgIcon
        size={size}
        className={`icon icon--${type} ${className}`}
        title={title}
      />
    );
  }

  // Fallback: legacy external SVG images
  const src = legacyIconMap[type];
  if (src) {
    return (
      <img
        src={src}
        alt={type}
        className={`icon icon--${type} ${className}`}
        title={title}
        style={{
          width: size ?? 16,
          height: size ?? 16,
          display: 'inline-block',
          verticalAlign: 'middle',
        }}
      />
    );
  }

  return null;
}
