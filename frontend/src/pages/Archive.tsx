import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Item } from '../types'

export function Archive() {
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/items/archived')
      .then(r => r.json())
      .then((data: Item[]) => setItems(data))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Archive</h1>
        <Link to="/"><button>← Dashboard</button></Link>
        <Link to="/items"><button style={{ background: 'none', border: '1px solid #888', cursor: 'pointer' }}>All Items</button></Link>
      </div>

      {items.length === 0 ? (
        <p style={{ color: '#555' }}>No archived items.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '4px 8px' }}>Photo</th>
              <th style={{ padding: '4px 8px' }}>Description</th>
              <th style={{ padding: '4px 8px' }}>Listings</th>
              <th style={{ padding: '4px 8px' }}>Archived</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '4px 8px' }}>
                  {item.photos.length > 0 ? (
                    <img
                      src={`/photos/${item.id}/${item.photos[0]}`}
                      style={{ width: 48, height: 48, objectFit: 'cover', display: 'block' }}
                      alt=""
                    />
                  ) : (
                    <span style={{ color: '#aaa' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '4px 8px' }}>
                  <Link to={`/items/${item.id}`}>
                    {item.rawDescription.slice(0, 60)}{item.rawDescription.length > 60 ? '…' : ''}
                  </Link>
                </td>
                <td style={{ padding: '4px 8px' }}>{item.listings?.length ?? 0}</td>
                <td style={{ padding: '4px 8px' }}>
                  {item.archivedAt ? item.archivedAt.slice(0, 10) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
