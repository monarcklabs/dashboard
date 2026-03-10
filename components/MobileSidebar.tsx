'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { NavLinks } from '@/components/NavLinks';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SearchTrigger } from '@/components/GlobalSearch';
import { MonarckMark } from '@/components/MonarckMark';
import { SidebarUsageWidget } from '@/components/sidebar/SidebarUsageWidget';

export function MobileSidebar({
  onOpenSearch,
}: {
  onOpenSearch?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  const handleSearchClick = useCallback(() => {
    setOpen(false);
    onOpenSearch?.();
  }, [onOpenSearch]);

  return (
    <>
      {/* Mobile header bar */}
      <header
        className="flex md:hidden items-center"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 60,
          height: '48px',
          gap: '12px',
          padding: '0 12px',
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderBottom: '1px solid var(--separator)',
        }}
      >
        {/* Hamburger / close toggle */}
        <button
          onClick={toggle}
          className="btn-ghost focus-ring"
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            transition: 'color 100ms var(--ease-smooth)',
          }}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Brand mark */}
        <div className="flex items-center gap-2" style={{ flex: 1 }}>
          <div aria-label="Monarck">
            <MonarckMark size={24} />
          </div>
        </div>
      </header>

      {/* Backdrop */}
      <div
        className="block md:hidden"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms var(--ease-smooth)',
        }}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-out sidebar panel */}
      <aside
        className="flex md:hidden flex-col"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 55,
          width: '280px',
          background: 'var(--sidebar-bg)',
          backdropFilter: 'var(--sidebar-backdrop)',
          WebkitBackdropFilter: 'var(--sidebar-backdrop)',
          borderRight: '1px solid var(--separator)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          boxShadow: open ? 'var(--shadow-overlay)' : 'none',
        }}
        aria-hidden={!open}
      >
        {/* Brand mark */}
        <div className="px-4 pt-5 pb-3">
          <div
            className="flex items-center"
            aria-label="Monarck"
            style={{ minHeight: '36px' }}
          >
            <MonarckMark size={32} />
          </div>
        </div>

        {/* Search trigger */}
        <div className="px-3 pb-2">
          <SearchTrigger onClick={handleSearchClick} />
        </div>

        <NavLinks bottomSlot={<SidebarUsageWidget />} />
        <ThemeToggle />
      </aside>
    </>
  );
}
