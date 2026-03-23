import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Item } from '../types'

export function ItemDetail() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<Item | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/v1/items/${id}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setItem)
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>
  if (!item) return <p>Item not found.</p>

  return (
    <div>
      <Link to="/">← Back to list</Link>
      <h1>{item.rawDescription.slice(0, 60)}{item.rawDescription.length > 60 ? '…' : ''}</h1>
      <pre>{JSON.stringify(item, null, 2)}</pre>
    </div>
  )
}
