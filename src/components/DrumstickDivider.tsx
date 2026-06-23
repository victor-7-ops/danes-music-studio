interface DrumstickDividerProps {
  className?: string
}

export function DrumstickDivider({ className = '' }: DrumstickDividerProps) {
  return (
    <svg
      viewBox="0 0 240 24"
      fill="currentColor"
      aria-hidden="true"
      className={`w-full h-auto text-ink ${className}`}
    >
      {/*
        Drumstick motif: a long tapered stick with a rounded tip at the right end.
        This is a hand-crafted geometric approximation of the drumstick
        visible in the DANES roundel. Replace with a precise trace if a vector
        version of the logo is obtained.
      */}
      <path d="
        M 8 11
        C 8 10 9 9.5 10 9.5
        L 200 9
        C 210 9 218 10 222 12
        C 226 14 228 16 226 18
        C 224 20 220 20 216 18
        C 212 16 206 15 200 15
        L 10 14.5
        C 9 14.5 8 14 8 13
        Z
      " />
    </svg>
  )
}
