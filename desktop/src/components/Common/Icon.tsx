import searchIcon from '../../../../assets/icon/search.svg';
import noteIcon from '../../../../assets/icon/note.svg';
import gudinIcon from '../../../../assets/icon/gudin.svg';
import shoucangIcon from '../../../../assets/icon/shoucang.svg';
import zuijinIcon from '../../../../assets/icon/zuijin.svg';
import shangchuIcon from '../../../../assets/icon/shanchu.svg';
import chongmingminIcon from '../../../../assets/icon/chongmingmin.svg';

export type IconType = 'search' | 'note' | 'gudin' | 'shoucang' | 'zuijin' | 'all' | 'pinned' | 'recent' | 'delete' | 'rename';

interface IconProps {
  type: IconType;
  className?: string;
  title?: string;
}

const iconMap: Record<IconType, string> = {
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

export function Icon({ type, className = '', title }: IconProps) {
  const src = iconMap[type];
  return (
    <img 
      src={src} 
      alt={type}
      className={`icon icon--${type} ${className}`}
      title={title}
      style={{ width: '1em', height: '1em', display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}
