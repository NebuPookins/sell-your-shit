import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Item } from '../types'

export function ItemList() {
  const [items, setItems] = useState<Item[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/items')
      .then(r => r.json())
      .then((data: Item[]) => setItems(data.filter(i => !i.archivedAt)))
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>

  async function deleteItem(id: string, description: string) {
    if (!confirm(`Delete "${description.slice(0, 60)}"?`)) return
    const res = await fetch(`/api/v1/items/${id}`, { method: 'DELETE' })
    if (res.ok) setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div>
      <h1>Listing Manager</h1>
      <Link to="/items/new"><button>+ New Item</button></Link>
      <Link to="/archive"><button style={{ background: 'none', border: '1px solid #888', cursor: 'pointer', marginLeft: 8 }}>Archive</button></Link>
      {items.length === 0 ? (
        <p>No items yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Listings</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td>
                  <Link to={`/items/${item.id}`}>
                    {item.rawDescription.slice(0, 60)}{item.rawDescription.length > 60 ? '…' : ''}
                  </Link>
                </td>
                <td>{item.listings?.length ?? 0}</td>
                <td>{item.createdAt.slice(0, 10)}</td>
                <td>
                  <button
                    onClick={() => deleteItem(item.id, item.rawDescription)}
                    style={{ color: '#c62828', background: 'none', border: '1px solid #c62828', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
