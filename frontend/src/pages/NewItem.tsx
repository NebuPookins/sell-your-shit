import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Item } from '../types'

export function NewItem() {
  const navigate = useNavigate()
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length > 10) {
      setError('Max 10 photos allowed')
      return
    }
    const tooBig = files.filter(f => f.size > 10 * 1024 * 1024)
    if (tooBig.length > 0) {
      setError('Each photo must be under 10 MB')
      return
    }
    setError(null)
    setPhotos(files)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('rawDescription', description)
      formData.append('minimumPrice', price)
      for (const file of photos) {
        formData.append('photos', file)
      }
      const res = await fetch('/api/v1/items', {
        method: 'POST',
        body: formData,
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
        <div>
          <label>
            Photos (optional, max 10, JPEG/PNG, 10 MB each)
            <br />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              onChange={handleFileChange}
            />
          </label>
          {photos.length > 0 && (
            <p>{photos.length} photo{photos.length !== 1 ? 's' : ''} selected</p>
          )}
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Item'}
        </button>
      </form>
    </div>
  )
}
