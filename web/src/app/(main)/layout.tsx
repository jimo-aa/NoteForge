'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const navItems = [
    { href: '/notes', label: t('sidebar.recentNotes'), icon: '📝' },
    { href: '/search', label: t('search.triggerText'), icon: '🔍' },
    { href: '/settings', label: t('manage.title'), icon: '⚙' },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>⚒ NoteForge</h1>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <button className={pathname.startsWith(item.href) ? 'active' : ''}>
                {item.icon} {item.label}
              </button>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>{user?.username || 'User'}</span>
          <button className="ghost-btn" onClick={logout} style={{ marginLeft: 'auto', padding: '4px 8px', fontSize: 11 }}>
            {t('sidebar.login')}
          </button>
        </div>
      </aside>
      <main className="main-panel">
        <div className="main-content">{children}</div>
      </main>
    </div>
  );
}
