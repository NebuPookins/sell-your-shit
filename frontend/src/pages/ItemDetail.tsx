import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Item } from '../types'

function PhotoStrip({ item, onUpdate }: { item: Item; onUpdate: (i: Item) => void }) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  async function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) return
    const newOrder = [...item.photos]
    const [moved] = newOrder.splice(dragIdx, 1)
    newOrder.splice(targetIdx, 0, moved)
    setDragIdx(null)
    const res = await fetch(`/api/v1/items/${item.id}/photos/order`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: newOrder }),
    })
    if (res.ok) onUpdate(await res.json())
  }

  async function deletePhoto(filename: string) {
    if (!confirm('Delete this photo?')) return
    const res = await fetch(`/api/v1/items/${item.id}/photos/${filename}`, { method: 'DELETE' })
    if (res.ok) onUpdate(await res.json())
  }

  if (item.photos.length === 0) return <p style={{ color: '#888' }}>No photos yet.</p>

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {item.photos.map((filename, idx) => (
        <div
          key={filename}
          draggable
          onDragStart={() => setDragIdx(idx)}
          onDragOver={e => e.preventDefault()}
          onDrop={() => handleDrop(idx)}
          style={{
            position: 'relative',
            cursor: 'grab',
            border: dragIdx === idx ? '2px dashed #999' : '2px solid transparent',
          }}
        >
          <img
            src={`/photos/${item.id}/${filename}`}
            style={{ width: 120, height: 120, objectFit: 'cover', display: 'block' }}
            alt={`Photo ${idx + 1}`}
          />
          <button
            onClick={() => deletePhoto(filename)}
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: 22,
              height: 22,
              cursor: 'pointer',
              lineHeight: '22px',
              padding: 0,
              fontSize: 12,
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

function AddPhotos({ itemId, onUpdate }: { itemId: string; onUpdate: (i: Item) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    const tooBig = files.filter(f => f.size > 10 * 1024 * 1024)
    if (tooBig.length > 0) {
      setError('Each photo must be under 10 MB')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      for (const file of files) formData.append('photos', file)
      const res = await fetch(`/api/v1/items/${itemId}/photos`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      onUpdate(await res.json())
      if (inputRef.current) inputRef.current.value = ''
    } catch (e) {
      setError(String(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <label>
        {uploading ? 'Uploading…' : 'Add photos:'}
        {' '}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          disabled={uploading}
          onChange={handleChange}
        />
      </label>
      {error && <span style={{ color: 'red', marginLeft: 8 }}>{error}</span>}
    </div>
  )
}

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

      <h2>Photos</h2>
      <PhotoStrip item={item} onUpdate={setItem} />
      <AddPhotos itemId={item.id} onUpdate={setItem} />

      <h2>Raw data</h2>
      <pre>{JSON.stringify(item, null, 2)}</pre>
    </div>
  )
}
