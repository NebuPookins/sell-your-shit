import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Item, PlatformProfile } from '../types'

const STORAGE_KEY = 'selectedPlatforms'

export function NewItem() {
  const navigate = useNavigate()
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [platforms, setPlatforms] = useState<PlatformProfile[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<'idle' | 'creating' | 'generating' | 'error'>('idle')
  const [createdItemId, setCreatedItemId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/v1/config/platforms')
      .then(r => r.json())
      .then((data: PlatformProfile[]) => {
        setPlatforms(data)
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          try {
            const parsed: string[] = JSON.parse(saved)
            const valid = parsed.filter(id => data.some(p => p.id === id))
            if (valid.length > 0) {
              setSelectedPlatforms(new Set(valid))
              return
            }
          } catch { /* ignore bad data */ }
        }
        setSelectedPlatforms(new Set(data.map(p => p.id)))
      })
      .catch(() => {/* non-fatal, platforms stay empty */})
  }, [])

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

  function togglePlatform(id: string) {
    setSelectedPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)))
      return next
    })
  }

  async function runGenerate(itemId: string) {
    setPhase('generating')
    try {
      const res = await fetch(`/api/v1/items/${itemId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platforms: Array.from(selectedPlatforms) }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `Server error ${res.status}` }))
        throw new Error(body.error ?? `Server error ${res.status}`)
      }
      navigate(`/items/${itemId}`)
    } catch (e) {
      setError(String(e))
      setPhase('error')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPhase('creating')
    setError(null)
    try {
      const formData = new FormData()
      formData.append('rawDescription', description)
for (const file of photos) {
        formData.append('photos', file)
      }
      const res = await fetch('/api/v1/items', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      const item: Item = await res.json()
      setCreatedItemId(item.id)

      if (selectedPlatforms.size === 0) {
        navigate(`/items/${item.id}`)
        return
      }

      await runGenerate(item.id)
    } catch (e) {
      setError(String(e))
      setPhase('error')
    }
  }

  const submitting = phase === 'creating' || phase === 'generating'

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
              disabled={submitting}
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
              disabled={submitting}
            />
          </label>
          {photos.length > 0 && (
            <p>{photos.length} photo{photos.length !== 1 ? 's' : ''} selected</p>
          )}
        </div>
        {platforms.length > 0 && (
          <div>
            <p><strong>Generate listings for:</strong></p>
            {platforms.map(p => (
              <label key={p.id} style={{ display: 'block', marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={selectedPlatforms.has(p.id)}
                  onChange={() => togglePlatform(p.id)}
                  disabled={submitting}
                />
                {' '}{p.label}
              </label>
            ))}
          </div>
        )}
        {error && (
          <div style={{ color: 'red', marginTop: 8 }}>
            <p>{error}</p>
            {phase === 'error' && createdItemId && (
              <button
                type="button"
                onClick={() => runGenerate(createdItemId)}
              >
                Retry Generation
              </button>
            )}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <button type="submit" disabled={submitting}>
            {phase === 'creating' ? 'Creating item…' :
             phase === 'generating' ? 'Generating listings… (this may take ~10s)' :
             'Create Item'}
          </button>
        </div>
      </form>
    </div>
  )
}
