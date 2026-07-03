'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/useAuthStore';

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) router.replace('/notes');
    else router.replace('/login');
  }, [isAuthenticated, router]);

  return <div className="auth-page"><div className="auth-card"><h2>NoteForge</h2><p>加载中...</p></div></div>;
}
