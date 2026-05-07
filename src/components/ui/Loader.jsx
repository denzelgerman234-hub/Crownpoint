export default function Loader({ label = 'Loading page...' }) {
  return (
    <div aria-live="polite" className="cp-loader-shell" role="status">
      <div className="cp-loader-mark" />
      <span>{label}</span>
    </div>
  )
}
