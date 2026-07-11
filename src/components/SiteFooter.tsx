const SOCIALS = [
  {
    name: 'Facebook',
    href: 'https://www.facebook.com/DaneMusicStudio',
    icon: (
      <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.5-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
    ),
  },
  {
    name: 'Instagram',
    href: 'https://www.instagram.com/danes.studio',
    icon: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.5" cy="6.5" r="1.2" />
      </>
    ),
  },
  {
    name: 'YouTube',
    href: 'https://www.youtube.com/@dmsproductions-ceb',
    icon: (
      <path d="M23 12s0-3.5-.45-5.1a3 3 0 0 0-2.1-2.1C18.8 4.3 12 4.3 12 4.3s-6.8 0-8.45.5a3 3 0 0 0-2.1 2.1C1 8.5 1 12 1 12s0 3.5.45 5.1a3 3 0 0 0 2.1 2.1c1.65.5 8.45.5 8.45.5s6.8 0 8.45-.5a3 3 0 0 0 2.1-2.1C23 15.5 23 12 23 12ZM9.75 15.5v-7l6 3.5-6 3.5Z" />
    ),
  },
  {
    name: 'Carrd (links)',
    href: 'https://dmsstudio.carrd.co',
    icon: (
      <path d="M3.9 12a4.1 4.1 0 0 1 4.1-4.1h4v1.9H8a2.2 2.2 0 1 0 0 4.4h4v1.9H8A4.1 4.1 0 0 1 3.9 12Zm6.1.9v-1.8h4v1.8h-4Zm2-.9a4.1 4.1 0 0 1 4.1-4.1h4v1.9h-4a2.2 2.2 0 1 0 0 4.4h4v1.9h-4A4.1 4.1 0 0 1 12 12Z" />
    ),
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-black">
      {/* Map — pinned to the studio's actual Google Maps listing (10.2904186, 123.864584) */}
      <div className="relative w-full h-80">
        <iframe
          title="Danes Music Studio location"
          src="https://www.google.com/maps?q=Danes+Music+Studio,10.2904186,123.864584&z=17&output=embed"
          className="absolute inset-0 w-full h-full border-0 grayscale invert-[0.92] contrast-[1.1]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      <div className="px-6 py-12 flex flex-col items-center text-center gap-6">
        <p className="font-display text-2xl uppercase text-white tracking-wide">
          Danes Music Studio
        </p>
        <p className="font-sans text-sm text-white/50">
          Jumalon St., Laguna Basak, Pardo, Cebu City &middot; Daily 9 AM–10 PM
        </p>

        {/* Social buttons */}
        <div className="flex items-center gap-3">
          {SOCIALS.map((s) => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.name}
              className="w-11 h-11 flex items-center justify-center rounded-full border border-white/15 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/5 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                {s.icon}
              </svg>
            </a>
          ))}
        </div>

        <p className="font-sans text-xs text-white/30 mt-4">
          &copy; {new Date().getFullYear()} Danes Music Studio
        </p>
      </div>
    </footer>
  )
}
