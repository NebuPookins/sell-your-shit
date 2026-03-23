import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Item } from '../types'

export function NewItem() {
  const navigate = useNavigate()
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawDescription: description, minimumPrice: Number(price) }),
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const item: Item = await res.json()
      navigate(`/items/${item.id}`)
    } catch (e) {
      setError(String(e))
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Link to="/">← Back</Link>
      <h1>New Item</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Description
            <br />
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
              rows={6}
              cols={60}
            />
          </label>
        </div>
        <div>
          <label>
            Minimum Price ($)
            <br />
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              required
              min="0"
              step="0.01"
            />
          </label>
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Item'}
        </button>
      </form>
    </div>
  )
}
