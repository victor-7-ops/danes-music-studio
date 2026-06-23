'use client'

export function SoundWave() {
  return (
    <div
      aria-hidden="true"
      className="soundwave-container"
    >
      <span className="bar bar-1" />
      <span className="bar bar-2" />
      <span className="bar bar-3" />
      <span className="bar bar-4" />
      <span className="bar bar-5" />
      <span className="bar bar-6" />

      <style jsx>{`
        .soundwave-container {
          display: none;
          position: absolute;
          left: 40px;
          top: 50%;
          transform: translateY(-50%);
          align-items: center;
          gap: 4px;
          height: 40px;
        }

        @media (min-width: 480px) {
          .soundwave-container {
            display: flex;
          }
        }

        .bar {
          display: block;
          width: 3px;
          border-radius: 2px;
          background-color: rgba(11, 11, 12, 0.4);
          animation: wave 1.2s ease-in-out infinite;
        }

        .bar-1 { animation-delay: 0s;    height: 12px; }
        .bar-2 { animation-delay: 0.15s; height: 24px; }
        .bar-3 { animation-delay: 0.3s;  height: 32px; }
        .bar-4 { animation-delay: 0.45s; height: 20px; }
        .bar-5 { animation-delay: 0.6s;  height: 28px; }
        .bar-6 { animation-delay: 0.75s; height: 14px; }

        @keyframes wave {
          0%, 100% { transform: scaleY(1); }
          50%       { transform: scaleY(0.25); }
        }
      `}</style>
    </div>
  )
}
