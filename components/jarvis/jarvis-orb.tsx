"use client"

// Jarvis Orb — reuses the self-contained Three.js orb (public/orb/orb.html) via
// an iframe composited with mix-blend:screen (drops the black bg, keeps the
// glow). When Jarvis is speaking it scales up, emits glowing shockwave rings,
// and an ECG line pulses beneath it. Purely visual, zero extra deps.

export function JarvisOrb({
  speaking,
  thinking,
  size = 220,
}: {
  speaking: boolean
  thinking?: boolean
  size?: number
}) {
  const active = speaking || thinking
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }} aria-hidden="true">
      {/* Shockwave rings — only while speaking */}
      {speaking && (
        <>
          <span className="orb-shockwave" style={{ animationDelay: "0s" }} />
          <span className="orb-shockwave" style={{ animationDelay: "0.7s" }} />
          <span className="orb-shockwave" style={{ animationDelay: "1.4s" }} />
        </>
      )}

      {/* The orb scene */}
      <div
        className="relative overflow-hidden rounded-full transition-transform duration-500"
        style={{
          width: size,
          height: size,
          transform: speaking ? "scale(1.06)" : "scale(1)",
          filter: active ? "none" : "saturate(0.7) brightness(0.8)",
        }}
      >
        <iframe
          src="/orb/orb.html"
          title="Jarvis"
          className="pointer-events-none absolute inset-0 h-full w-full border-0"
          style={{ mixBlendMode: "screen", transform: "scale(1.25)" }}
          scrolling="no"
        />
      </div>

      {/* ECG heartbeat line under the orb while speaking */}
      {speaking && (
        <svg
          className="pointer-events-none absolute left-1/2 bottom-1 h-8 w-[140%] -translate-x-1/2 overflow-visible"
          viewBox="0 0 200 40"
          preserveAspectRatio="none"
        >
          <polyline
            className="orb-ecg"
            points="0,20 40,20 52,20 58,6 66,34 74,14 82,20 120,20 132,20 138,10 146,30 154,20 200,20"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  )
}
