interface NavItem {
  id: string;
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
}

export function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  return (
    <div className="nav-section">
      <div className="nav-section-header">{title}</div>
      <div className="nav-items">
        {items.map(item => (
          <button
            key={item.id}
            className={`nav-item${item.active ? ' active' : ''}`}
            onClick={item.onClick}
          >
            <span className="nav-label">{item.label}</span>
            {item.count !== undefined && <span className="count">{item.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
