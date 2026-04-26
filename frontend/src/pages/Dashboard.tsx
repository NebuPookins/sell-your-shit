import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { DashboardEntry, DashboardResponse } from '../types'

const fmtDate = (s: string | null) => s ? s.slice(0, 10) : '—'

const daysUntil = (s: string | null): number | null => {
  if (!s) return null
  const diff = new Date(s.slice(0, 10)).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()
  return Math.round(diff / 86400000)
}

const fmtDaysUntil = (s: string | null): string => {
  const d = daysUntil(s)
  if (d === null) return '—'
  if (d === 0) return 'today'
  if (d === 1) return '1 day'
  if (d === -1) return '-1 day'
  return `${d} days`
}

const RENEWAL_REASON_LABEL: Record<string, string> = {
  'expired': 'Expired',
  'expiring-soon': 'Expiring Soon',
  'decay-due': 'Price Drop Due',
}

function RenewalCard({ entry }: { entry: DashboardEntry }) {
  return (
    <div style={{ border: '1px solid #e57373', borderRadius: 8, padding: 12, width: 220 }}>
      {entry.itemThumbnail && (
        <img
          src={`/photos/${entry.itemId}/${entry.itemThumbnail}`}
          style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 4, display: 'block' }}
          alt=""
        />
      )}
      <p style={{ margin: '8px 0 4px', fontWeight: 600 }}>
        <Link to={`/items/${entry.itemId}`}>{(entry.title ?? entry.itemDescription).slice(0, 50)}</Link>
      </p>
      <p style={{ margin: '2px 0', fontSize: 13 }}>{entry.platformId}</p>
      {entry.askingPrice != null && (
        <p style={{ margin: '2px 0', fontSize: 13 }}>${entry.askingPrice.toFixed(2)}</p>
      )}
      {entry.daysActive != null && (
        <p style={{ margin: '2px 0', fontSize: 13 }}>{entry.daysActive} days active</p>
      )}
      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#c62828', fontWeight: 600 }}>
        {RENEWAL_REASON_LABEL[entry.renewalReason ?? ''] ?? entry.renewalReason}
      </p>
    </div>
  )
}

export function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [closedOpen, setClosedOpen] = useState(false)

  useEffect(() => {
    fetch('/api/v1/dashboard')
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(String(e)))
  }, [])

  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>
  if (!data) return <p>Loading...</p>

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Listing Manager</h1>
        <Link to="/items/new"><button>+ New Item</button></Link>
        <Link to="/items"><button style={{ background: 'none', border: '1px solid #888', cursor: 'pointer' }}>All Items</button></Link>
      </div>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ marginTop: 0 }}>Renewal Queue ({data.renewalQueue.length})</h2>
        {data.renewalQueue.length === 0 ? (
          <p style={{ color: '#555' }}>No listings need attention.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {data.renewalQueue.map(entry => (
              <RenewalCard key={entry.listingId} entry={entry} />
            ))}
          </div>
        )}
      </section>

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
