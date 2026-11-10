'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/lib/actions/admin/logout'

const NAV_GROUPS = [
  {
    items: [
      {
        label: 'Dashboard',
        href: '/admin/dashboard',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
        ),
      },
      {
        label: 'Calendar',
        href: '/admin/calendar',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        ),
      },
      {
        label: 'Bookings',
        href: '/admin/bookings',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Create',
    items: [
      {
        label: 'Advanced Booking',
        href: '/admin/new-booking',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        ),
      },
      {
        label: 'Walk-in',
        href: '/admin/walk-in',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="7" r="2" /><path d="M10 22v-5l-2-3 3-5 2 3 2-3 3 5-2 3v5" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Manage',
    items: [
      {
        label: 'Maintenance',
        href: '/admin/maintenance',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        ),
      },
      {
        label: 'Special Hours',
        href: '/admin/special-hours',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
          </svg>
        ),
      },
      {
        label: 'Vouchers',
        href: '/admin/vouchers',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2 9a3 3 0 1 0 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 1 0 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v3z" />
            <path d="M9 4v16" strokeDasharray="2 2" />
          </svg>
        ),
      },
      {
        label: 'Settings',
        href: '/admin/settings',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        ),
      },
    ],
  },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-ink/10 bg-[#f5f4f0] px-4 md:hidden">
        <button onClick={() => setIsOpen(!isOpen)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-ink/5" aria-label={isOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={isOpen}>
          <span className="text-xl" aria-hidden="true">{isOpen ? '×' : '☰'}</span>
        </button>
        <span className="font-display text-sm uppercase tracking-[0.2em]">DANES <span className="font-sans text-xs normal-case tracking-normal text-muted">Studio</span></span>
        <Link href="/admin/new-booking" className="rounded-lg bg-ink px-3 py-2 text-xs font-medium text-bg">New booking</Link>
      </header>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed left-0 top-0 h-full z-40 w-60 bg-white border-r border-ink/10 flex flex-col font-sans transition-transform duration-200',
          'md:translate-x-0',
          isOpen ? 'visible translate-x-0' : 'invisible -translate-x-full md:visible md:translate-x-0',
        ].join(' ')}
      >
        {/* Logo / wordmark */}
        <div className="px-6 py-6 border-b border-ink/10">
          <span className="font-display text-xl uppercase tracking-[0.18em] text-ink">
            DANES
          </span>
          <span className="block font-sans text-[10px] text-muted uppercase tracking-[0.2em] mt-0.5">
            STUDIO OPERATIONS
          </span>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3" aria-label="Admin navigation">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-1 pt-1 border-t border-ink/5' : ''}>
              {group.label && (
                <span className="block px-6 pt-3 pb-1 text-[10px] uppercase tracking-[0.15em] text-muted/60 font-sans">
                  {group.label}
                </span>
              )}
              {group.items.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href))
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsOpen(false)}
                    className={[
                      'flex items-center gap-3 mx-3 rounded-lg px-3 py-2.5 min-h-11 text-sm transition-colors',
                      isActive
                        ? 'bg-[#eeece6] font-medium text-ink'
                        : 'text-muted hover:bg-ink/5 hover:text-ink',
                    ].join(' ')}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="shrink-0 opacity-70">{link.icon}</span>
                    {link.label}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className="border-t border-ink/10 p-3">
          <form action={logout}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-6 py-2.5 min-h-11 text-sm uppercase tracking-widest text-muted hover:text-ink hover:bg-ink/5 transition-colors text-left"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Logout
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
