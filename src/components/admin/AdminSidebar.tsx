'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/lib/actions/admin/logout'

const NAV_LINKS = [
  { label: 'Calendar', href: '/admin/calendar' },
  { label: 'Bookings', href: '/admin/bookings' },
  { label: 'Walk-in', href: '/admin/walk-in' },
  { label: 'New Booking', href: '/admin/new-booking' },
  { label: 'Maintenance', href: '/admin/maintenance' },
  { label: 'Special Hours', href: '/admin/special-hours' },
  { label: 'Settings', href: '/admin/settings' },
  { label: 'Dashboard', href: '/admin/dashboard' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-bg border border-ink/20 p-2"
        aria-label="Toggle navigation"
      >
        <span className="block w-5 h-0.5 bg-ink mb-1" />
        <span className="block w-5 h-0.5 bg-ink mb-1" />
        <span className="block w-5 h-0.5 bg-ink" />
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'fixed left-0 top-0 h-full z-40 w-56 bg-bg border-r border-ink/10 flex flex-col font-sans transition-transform duration-200',
          'md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {/* Logo / wordmark */}
        <div className="px-6 py-6 border-b border-ink/10">
          <span className="font-display text-xl uppercase tracking-widest text-ink">
            DANES
          </span>
          <span className="block font-sans text-xs text-muted uppercase tracking-widest">
            Admin
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4">
          {NAV_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={[
                  'block px-6 py-3 text-sm uppercase tracking-widest transition-colors',
                  isActive
                    ? 'bg-ink text-bg'
                    : 'text-ink hover:bg-ink/5',
                ].join(' ')}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-ink/10 p-4">
          <form action={logout}>
            <button
              type="submit"
              className="w-full px-6 py-3 text-sm uppercase tracking-widest text-muted hover:text-ink hover:bg-ink/5 transition-colors text-left"
            >
              Logout
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}
