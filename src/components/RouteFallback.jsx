import './RouteFallback.css'

/** Shown while lazy route chunks load (important on Android WebView). */
export default function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-live="polite">
      <div className="route-fallback__spinner" aria-hidden />
      <span className="route-fallback__text">Loading…</span>
    </div>
  )
}
