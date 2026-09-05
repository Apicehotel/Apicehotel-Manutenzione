export function PageTitle({ title, subtitle, eyebrow, action, className = '' }) {
  return (
    <header className={`rs-page-title rs-randui-local-header ${className}`.trim()} data-randui-local-header>
      <div className="rs-randui-local-header__copy">
        {eyebrow && <span className="rs-randui-local-header__eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="rs-randui-local-header__actions">{action}</div>}
    </header>
  )
}

export function Surface({ as: Tag = 'section', tone = 'default', padded = true, children, className = '', ...rest }) {
  return (
    <Tag
      className={`rs-randui-surface ${padded ? 'rs-randui-surface--padded' : ''} ${className}`.trim()}
      data-randui-surface-tone={tone}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function Stack({ as: Tag = 'div', gap = 'md', children, className = '', ...rest }) {
  return <Tag className={`rs-randui-stack rs-randui-stack--${gap} ${className}`.trim()} {...rest}>{children}</Tag>
}

export function Grid({ as: Tag = 'div', columns = 'auto', gap = 'md', children, className = '', ...rest }) {
  return (
    <Tag className={`rs-randui-grid rs-randui-grid--${columns} rs-randui-grid--gap-${gap} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  )
}

export function Metric({ value, label, tone = 'default', compact = false, className = '' }) {
  return (
    <div className={`rs-randui-metric ${compact ? 'rs-randui-metric--compact' : ''} ${className}`.trim()} data-randui-tone={tone}>
      <b>{value}</b>
      <small>{label}</small>
    </div>
  )
}
