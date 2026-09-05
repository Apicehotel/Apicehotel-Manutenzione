import { assertRandUiComposition } from './guard.js'
import { randUiPageFor } from './page-catalog.js'
import { TemplateFrame } from './templates.jsx'

const BOUNDARY_COMPONENTS = Object.freeze(['TemplateFrame'])

export default function RandUiPageBoundary({ pageId, children, className = '' }) {
  const page = randUiPageFor(pageId)
  if (!page) throw new Error(`RandUI page is not catalogued: ${pageId || '(empty)'}`)

  assertRandUiComposition(page, { components: BOUNDARY_COMPONENTS })

  return (
    <TemplateFrame
      templateId={page.pageType}
      className={`rs-randui-page--migrated ${className}`.trim()}
      data-randui-page={page.id}
      data-randui-domain={page.domain}
      data-randui-density={page.density}
      data-randui-migration={page.migration}
    >
      {children}
    </TemplateFrame>
  )
}
