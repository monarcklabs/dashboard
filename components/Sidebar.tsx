'use client';

import { useCallback } from 'react';
import { NavLinks } from '@/components/NavLinks';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileSidebar } from '@/components/MobileSidebar';
import { MonarckMark } from '@/components/MonarckMark';
import { SidebarUsageWidget } from '@/components/sidebar/SidebarUsageWidget';
import { GlobalSearch, SearchTrigger } from '@/components/GlobalSearch';

/**
 * Sidebar -- client wrapper that coordinates desktop sidebar, mobile sidebar,
 * and the Cmd+K search palette. Rendered inside layout.tsx.
 */
export function Sidebar() {
  const openSearch = useCallback(() => {
    // We trigger the search modal by simulating Cmd+K.
    // Instead, we expose a controlled open state via a custom event.
    // The GlobalSearch component listens for this.
    window.dispatchEvent(new CustomEvent('clawport:open-search'));
  }, []);

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <aside
        className="hidden md:flex md:flex-col"
        style={{
          width: '220px',
          flexShrink: 0,
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderRight: '1px solid var(--separator)',
        }}
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
          <SearchTrigger onClick={openSearch} />
        </div>

        <NavLinks bottomSlot={<SidebarUsageWidget />} />
        <ThemeToggle />
      </aside>

      {/* Mobile sidebar */}
      <MobileSidebar onOpenSearch={openSearch} />

      {/* Global search modal (Cmd+K) */}
      <GlobalSearch />
    </>
  );
}
