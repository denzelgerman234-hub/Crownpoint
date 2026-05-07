export default function PageWrapper({ children, className = '' }) {
  const classes = ['cp-page', className].filter(Boolean).join(' ')
  return <div className={classes}>{children}</div>
}
