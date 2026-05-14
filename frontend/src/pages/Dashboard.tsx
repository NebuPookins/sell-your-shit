import { LocalDate } from '@js-joda/core'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { daysUntil } from '../dateUtils'
import { ExpiryDateInput } from '../ExpiryDateInput'
import type { DashboardEntry, DashboardResponse } from '../types'

const fmtDate = (s: string | null) => s ? s.slice(0, 10) : '—'

const fmtDaysUntil = (s: string | null): string => {
  if (!s) return '—'
  const d = daysUntil(LocalDate.parse(s.slice(0, 10)))
  if (d === 0) return 'today'
  if (d === 1) return '1 day'
  if (d === -1) return '-1 day'
  return `${d} days`
}

const RENEWAL_REASON_LABEL: Record<string, string> = {
  'expired': 'Expired',
  'decay-due': 'Price Drop Due',
}

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
}
const MODAL: React.CSSProperties = {
  background: '#fff', borderRadius: 8, padding: 28, minWidth: 360,
  boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
}

function RenewModal({
  entry,
  dropPercent,
  onClose,
}: {
  entry: DashboardEntry
  dropPercent: number
  onClose: () => void
}) {
  const suggestedPrice = entry.suggestedDropPrice ?? entry.askingPrice
  const [newPrice, setNewPrice] = useState(suggestedPrice ? String(suggestedPrice) : '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pctLabel = Math.round(dropPercent * 100)
  const isDecayDue = entry.renewalReasons.includes('decay-due')
  const isExpired = entry.renewalReasons.includes('expired')
  const [expiresAt, setExpiresAt] = useState(entry.expiresAt ?? '')

  async function handleRenew() {
    const parsed = parseFloat(newPrice)
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid price')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { newPrice: parsed }
      if (isExpired && expiresAt) body.expiresAt = expiresAt
      const res = await fetch(`/api/v1/listings/${entry.listingId}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={OVERLAY}>
      <div style={MODAL}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>
          Renew — {(entry.title ?? entry.itemDescription).slice(0, 50)}
        </h3>
        <p style={{ marginBottom: 8, color: '#555', fontSize: 13 }}>{entry.platformId}</p>

        {entry.externalId && (
          <p style={{ marginBottom: 16 }}>
            <a href={entry.externalId} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
              Open listing on {entry.platformId} &rarr;
            </a>
          </p>
        )}

        {isDecayDue && entry.askingPrice != null && (
          <div style={{ background: '#f5f5f5', borderRadius: 6, padding: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Current price:</span>
              <span style={{ fontWeight: 600 }}>${entry.askingPrice.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span>Suggested drop ({pctLabel}%):</span>
              <span style={{ color: '#c62828', fontWeight: 600 }}>
                -${(entry.askingPrice - parseFloat(newPrice || '0')).toFixed(2)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ddd', paddingTop: 8 }}>
              <span style={{ fontWeight: 600 }}>Suggested new price:</span>
              <span style={{ color: '#2e7d32', fontWeight: 700, fontSize: 18 }}>
                ${parseFloat(newPrice || '0').toFixed(2)}
              </span>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
            New price
          </label>
          <input
            type="number"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
            style={{ padding: 4, width: 120, fontSize: 16 }}
          />
        </div>

        {isExpired && (
          <ExpiryDateInput value={expiresAt} onChange={setExpiresAt} label="New expiry date" />
        )}

        {error && <div style={{ color: 'red', fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={submitting}>Cancel</button>
          <Link to={`/items/${entry.itemId}?listing=${entry.listingId}`}>
            <button
              style={{ background: 'none', border: '1px solid #888', cursor: 'pointer' }}
              disabled={submitting}
            >
              Edit Manually
            </button>
          </Link>
          <button
            onClick={handleRenew}
            disabled={submitting}
            style={{ background: '#f57c00', color: '#fff', border: 'none', padding: '6px 18px', borderRadius: 4, cursor: 'pointer' }}
          >
            {submitting ? 'Renewing…' : 'Renew'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [closedOpen, setClosedOpen] = useState(false)
  const [renewEntry, setRenewEntry] = useState<DashboardEntry | null>(null)
  const [dropPercent, setDropPercent] = useState(0.1)

  function load() {
    Promise.all([
      fetch('/api/v1/dashboard').then(r => r.json()),
      fetch('/api/v1/config/decay').then(r => r.json()),
    ])
      .then(([dashboardData, decayData]) => {
        setData(dashboardData)
        if (decayData['drop-percent'] != null) setDropPercent(decayData['drop-percent'])
      })
      .catch(e => setError(String(e)))
  }

  useEffect(load, [])

  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>
  if (!data) return <p>Loading...</p>

  return (
    <div style={{ padding: 16 }}>
      {renewEntry && (
        <RenewModal
          entry={renewEntry}
          dropPercent={dropPercent}
          onClose={() => { setRenewEntry(null); load() }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Listing Manager</h1>
        <Link to="/items/new"><button>+ New Item</button></Link>
        <Link to="/items"><button style={{ background: 'none', border: '1px solid #888', cursor: 'pointer' }}>All Items</button></Link>
        <Link to="/archive"><button style={{ background: 'none', border: '1px solid #888', cursor: 'pointer' }}>Archive</button></Link>
      </div>

      {(() => {
        const needsActionItems = [
          ...data.needsAction.map(e => ({ ...e, _action: 'needs-sold' as const })),
          ...data.renewalQueue.map(e => ({ ...e, _action: 'renewal' as const })),
        ].sort((a, b) => {
          if (a._action !== b._action) return a._action === 'needs-sold' ? -1 : 1
          return (a.expiresAt ?? '').localeCompare(b.expiresAt ?? '')
        })

        return needsActionItems.length > 0 ? (
          <section style={{ marginBottom: 32 }}>
            <h2 style={{ marginTop: 0, color: '#c62828' }}>
              Needs Action ({needsActionItems.length})
            </h2>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #e57373' }}>
                  <th style={{ padding: '4px 8px' }}>Photo</th>
                  <th style={{ padding: '4px 8px' }}>Title</th>
                  <th style={{ padding: '4px 8px' }}>Platform</th>
                  <th style={{ padding: '4px 8px' }}>Price</th>
                  <th style={{ padding: '4px 8px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {needsActionItems.map(entry => (
                  <tr key={entry.listingId} style={{ borderBottom: '1px solid #ffcdd2' }}>
                    <td style={{ padding: '4px 8px' }}>
                      {entry.itemThumbnail ? (
                        <img src={`/photos/${entry.itemId}/${entry.itemThumbnail}`}
                          style={{ width: 48, height: 48, objectFit: 'cover', display: 'block' }} alt="" />
                      ) : <span style={{ color: '#aaa' }}>—</span>}
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      <Link to={`/items/${entry.itemId}`}>
                        {(entry.title ?? entry.itemDescription).slice(0, 60)}
                      </Link>
                    </td>
                    <td style={{ padding: '4px 8px' }}>{entry.platformId}</td>
                    <td style={{ padding: '4px 8px' }}>
                      {entry.askingPrice != null ? `$${entry.askingPrice.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ padding: '4px 8px' }}>
                      {entry._action === 'needs-sold' ? (
                        <span style={{ color: '#c62828', fontWeight: 600, fontSize: 13 }}>needs sold</span>
                      ) : (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          {entry.renewalReasons.map(r => (
                            <span key={r} style={{ fontSize: 12, color: '#c62828', fontWeight: 600 }}>
                              {RENEWAL_REASON_LABEL[r] ?? r}
                            </span>
                          ))}
                          <button onClick={() => setRenewEntry(entry)}
                            style={{
                              background: '#f57c00', color: '#fff', border: 'none',
                              padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
                            }}>
                            Renew
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null
      })()}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ marginTop: 0 }}>All Active Listings ({data.activeListings.length})</h2>
        {data.activeListings.length === 0 ? (
          <p style={{ color: '#555' }}>No active listings.</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '4px 8px' }}>Photo</th>
                <th style={{ padding: '4px 8px' }}>Title</th>
                <th style={{ padding: '4px 8px' }}>Platform</th>
                <th style={{ padding: '4px 8px' }}>Price</th>
                <th style={{ padding: '4px 8px' }}>Posted</th>
                <th style={{ padding: '4px 8px' }}>Expires</th>
                <th style={{ padding: '4px 8px' }}>Expires in</th>
                <th style={{ padding: '4px 8px' }}>Days Active</th>
              </tr>
            </thead>
            <tbody>
              {data.activeListings.map(entry => (
                <tr key={entry.listingId} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '4px 8px' }}>
                    {entry.itemThumbnail ? (
                      <img
                        src={`/photos/${entry.itemId}/${entry.itemThumbnail}`}
                        style={{ width: 48, height: 48, objectFit: 'cover', display: 'block' }}
                        alt=""
                      />
                    ) : <span style={{ color: '#aaa' }}>—</span>}
                  </td>
                  <td style={{ padding: '4px 8px' }}>
                    <Link to={`/items/${entry.itemId}`}>
                      {(entry.title ?? entry.itemDescription).slice(0, 60)}
                    </Link>
                  </td>
                  <td style={{ padding: '4px 8px' }}>{entry.platformId}</td>
                  <td style={{ padding: '4px 8px' }}>
                    {entry.askingPrice != null ? `$${entry.askingPrice.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                    {fmtDate(entry.postedAt)}
                  </td>
                  <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                    {fmtDate(entry.expiresAt)}
                  </td>
                  <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                    {fmtDaysUntil(entry.expiresAt)}
                  </td>
                  <td style={{ padding: '4px 8px' }}>{entry.daysActive ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2
          style={{ marginTop: 0, cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setClosedOpen(o => !o)}
        >
          {closedOpen ? '▼' : '▶'} Recently Sold / Cancelled ({data.closedItems.length} items)
        </h2>
        {closedOpen && (
          data.closedItems.length === 0 ? (
            <p style={{ color: '#555' }}>None.</p>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '4px 8px' }}>Description</th>
                  <th style={{ padding: '4px 8px' }}>Listings</th>
                </tr>
              </thead>
              <tbody>
                {data.closedItems.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '4px 8px' }}>
                      <Link to={`/items/${item.id}`}>{item.rawDescription.slice(0, 60)}</Link>
                    </td>
                    <td style={{ padding: '4px 8px' }}>{item.listings.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </section>
    </div>
  )
}
