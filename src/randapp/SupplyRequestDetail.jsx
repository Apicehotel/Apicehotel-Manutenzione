import { useMemo, useState } from 'react'
import OperationalDetailPage from './OperationalDetailPage.jsx'
import OperationalTimeline from './OperationalTimeline.jsx'
import { buildSupplyTimeline } from './task-supply-timeline.js'

const CATEGORY_LABEL = { minibar: 'Minibar', consumo: 'Consumo' }
const STATUS_LABEL = { pending: 'In attesa', delivered: 'Consegnato', missing: 'Manca' }

export default function SupplyRequestDetail({ request, hotel, canComplete, onResolve, onBack }) {
  const [busyId, setBusyId] = useState(null)
  const events = useMemo(() => buildSupplyTimeline(request), [request])
  const context = [request.area_label, request.floor_label].filter(Boolean).join(' · ')

  const resolve = async (itemId, status) => {
    if (busyId) return
    setBusyId(itemId)
    try { await onResolve?.(itemId, status) } finally { setBusyId(null) }
  }

  return (
    <OperationalDetailPage
      kind="supply"
      resourceId={request.id}
      title="Richiesta rifornimento"
      subtitle={[hotel?.name, context].filter(Boolean).join(' · ')}
      onBack={onBack}
      className="rs-supply-request-detail"
    >
      {request.note && <p className="rs-detail-desc">{request.note}</p>}
      <OperationalTimeline events={events} />
      <div className="rs-supply-items">
        {(request.supply_request_items || []).map((item) => (
          <div key={item.id} className={`rs-supply-item status-${item.status}`}>
            <span>
              <b>{item.product_name}</b>
              <small>{CATEGORY_LABEL[item.category] || item.category} · {STATUS_LABEL[item.status] || item.status}</small>
            </span>
            {item.status === 'pending' && canComplete && (
              <div className="rs-supply-actions">
                <button type="button" className="deliver" disabled={busyId===item.id} onClick={() => resolve(item.id, 'delivered')}>✓ Consegnato</button>
                <button type="button" className="missing" disabled={busyId===item.id} onClick={() => resolve(item.id, 'missing')}>! Manca</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </OperationalDetailPage>
  )
}
