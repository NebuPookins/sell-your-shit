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

  return (
    <div>
      <h1>Listing Manager</h1>
      <Link to="/items/new"><button>+ New Item</button></Link>
      {items.length === 0 ? (
        <p>No items yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Listings</th>
              <th>Created</th>
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
                <td>{new Date(item.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
