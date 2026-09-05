import { resolveRandUiTemplate } from './template-registry.js'

export function TemplateFrame({
  templateId,
  eyebrow,
  title,
  description,
  actions,
  toolbar,
  aside,
  footer,
  children,
  className = '',
  ...rest
}) {
  const template = resolveRandUiTemplate(templateId)
  if (!template) throw new Error(`Unknown RandUI template: ${templateId}`)
  return (
    <section className={`rs-randui-page rs-randui-page--${templateId} ${className}`} data-randui-template={templateId} {...rest}>
      {(eyebrow || title || description || actions) && (
        <header className="rs-randui-page__header" data-randui-slot="header">
          <div className="rs-randui-page__heading">
            {eyebrow && <span className="rs-randui-page__eyebrow">{eyebrow}</span>}
            {title && <h1>{title}</h1>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="rs-randui-page__actions">{actions}</div>}
        </header>
      )}
      {toolbar && <div className="rs-randui-page__toolbar" data-randui-slot="toolbar">{toolbar}</div>}
      <div className={`rs-randui-page__body ${aside ? 'rs-randui-page__body--aside' : ''}`} data-randui-slot="content">
        <div className="rs-randui-page__content">{children}</div>
        {aside && <aside className="rs-randui-page__aside" data-randui-slot="aside">{aside}</aside>}
      </div>
      {footer && <footer className="rs-randui-page__footer" data-randui-slot="footer">{footer}</footer>}
    </section>
  )
}

const makeTemplate = (templateId) => function RandUiTemplate(props) {
  return <TemplateFrame templateId={templateId} {...props} />
}

export const DashboardTemplate = makeTemplate('dashboard')
export const ListTemplate = makeTemplate('list')
export const ListDetailTemplate = makeTemplate('list-detail')
export const MasterDetailTemplate = makeTemplate('master-detail')
export const OperationalTemplate = makeTemplate('operational')
export const PlanningTemplate = makeTemplate('planning')
export const FormTemplate = makeTemplate('form')
export const WizardTemplate = makeTemplate('wizard')
export const SettingsTemplate = makeTemplate('settings')
export const ManagementTemplate = makeTemplate('management')
export const MonitorTemplate = makeTemplate('monitor')
export const SystemStateTemplate = makeTemplate('system-state')
export const AuthTemplate = makeTemplate('auth')
export const SearchArchiveTemplate = makeTemplate('search-archive')
