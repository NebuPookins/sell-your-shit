import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { FieldSpec, Item, Listing, PlatformProfile } from '../types'

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

  if ((item.photos?.length ?? 0) === 0) return <p style={{ color: '#888', fontSize: 13 }}>No photos yet.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {(item.photos ?? []).map((filename, idx) => (
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
    } catch (err) {
      setError(String(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <label style={{ fontSize: 13 }}>
        {uploading ? 'Uploading…' : 'Add photos:'}
        {' '}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          multiple
          disabled={uploading}
          onChange={handleChange}
          style={{ fontSize: 12 }}
        />
      </label>
      {error && <div style={{ color: 'red', fontSize: 12 }}>{error}</div>}
    </div>
  )
}

function FieldInput({
  spec,
  value,
  isUncertain,
  onChange,
  onBlur,
}: {
  spec: FieldSpec
  value: string
  isUncertain: boolean
  onChange: (v: string) => void
  onBlur: (v: string) => void
}) {
  const base: React.CSSProperties = isUncertain
    ? { flex: 1, background: '#fffbcc', color: '#333' }
    : { flex: 1 }

  if (spec.type === 'multiline') {
    return (
      <textarea
        value={value}
        style={{ ...base, minHeight: 80, resize: 'vertical', padding: 4 }}
        onChange={e => onChange(e.target.value)}
        onBlur={e => onBlur(e.target.value)}
      />
    )
  }
  if (spec.type === 'enum') {
    return (
      <select
        value={value}
        style={{ ...base }}
        onChange={e => { onChange(e.target.value); onBlur(e.target.value) }}
      >
        {(spec.values ?? []).map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    )
  }
  return (
    <input
      type={spec.type === 'number' ? 'number' : 'text'}
      value={value}
      style={{ ...base, padding: 4 }}
      onChange={e => onChange(e.target.value)}
      onBlur={e => onBlur(e.target.value)}
    />
  )
}

function MarkPostedModal({
  listingId,
  initialExternalId = '',
  onClose,
  onPosted,
}: {
  listingId: string
  initialExternalId?: string
  onClose: () => void
  onPosted: (l: Listing) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [postedAt, setPostedAt] = useState(today)
  const [expiresAt, setExpiresAt] = useState('')
  const [externalId, setExternalId] = useState(initialExternalId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!expiresAt) { setError('Expiry date is required'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/listings/${listingId}/mark-posted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postedAt, expiresAt, externalId: externalId || null }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onPosted(await res.json())
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: '#fff', borderRadius: 8, padding: 28, minWidth: 340, boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      }}>
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>Mark as Posted</h3>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Posted date</label>
          <input type="date" value={postedAt} onChange={e => setPostedAt(e.target.value)} style={{ padding: 4, width: '100%' }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Expiry date</label>
          <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} style={{ padding: 4, width: '100%' }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>External listing URL (optional)</label>
          <input type="text" value={externalId} onChange={e => setExternalId(e.target.value)} placeholder="https://…" style={{ padding: 4, width: '100%' }} />
        </div>
        {error && <div style={{ color: 'red', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            onClick={submit}
            disabled={submitting}
            style={{ background: '#1976d2', color: '#fff', border: 'none', padding: '6px 18px', borderRadius: 4, cursor: 'pointer' }}
          >
            {submitting ? 'Saving…' : 'Mark as Posted'}
          </button>
        </div>
      </div>
    </div>
  )
}

function daysFromToday(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

function dateFromDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function ListingTab({
  listing,
  platform,
  onUpdate,
}: {
  listing: Listing
  platform: PlatformProfile | undefined
  onUpdate: (l: Listing) => void
}) {
  const [fields, setFields] = useState<Record<string, string>>(listing.generatedFields)
  const [askingPrice, setAskingPrice] = useState<number | null>(listing.askingPrice)
  const [notes, setNotes] = useState(listing.notes)
  const [postedAt, setPostedAt] = useState(listing.postedAt ?? '')
  const [expiresAt, setExpiresAt] = useState(listing.expiresAt ?? '')
  const [expiresAtDays, setExpiresAtDays] = useState(listing.expiresAt ? String(daysFromToday(listing.expiresAt)) : '')
  const [externalId, setExternalId] = useState(listing.externalId ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showMarkPosted, setShowMarkPosted] = useState(false)

  // Refs so blur handlers always read latest values without stale-closure issues
  const fieldsRef = useRef(fields)
  fieldsRef.current = fields
  const askingPriceRef = useRef(askingPrice)
  askingPriceRef.current = askingPrice
  const notesRef = useRef(notes)
  notesRef.current = notes
  const postedAtRef = useRef(postedAt)
  postedAtRef.current = postedAt
  const expiresAtRef = useRef(expiresAt)
  expiresAtRef.current = expiresAt
  const externalIdRef = useRef(externalId)
  externalIdRef.current = externalId

  async function save(
    currentFields: Record<string, string>,
    currentPrice: number | null,
    currentNotes: string,
    currentPostedAt: string,
    currentExpiresAt: string,
    currentExternalId: string
  ) {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/v1/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generatedFields: currentFields,
          askingPrice: currentPrice,
          notes: currentNotes,
          postedAt: currentPostedAt || null,
          expiresAt: currentExpiresAt || null,
          externalId: currentExternalId || null,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onUpdate(await res.json())
    } catch (err) {
      setSaveError(String(err))
    } finally {
      setSaving(false)
    }
  }

  function saveAll() {
    save(fieldsRef.current, askingPriceRef.current, notesRef.current, postedAtRef.current, expiresAtRef.current, externalIdRef.current)
  }

  async function markPosted(effectivePostedAt: string, effectiveExpiresAt: string, currentExternalId: string) {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/v1/listings/${listing.id}/mark-posted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postedAt: effectivePostedAt,
          expiresAt: effectiveExpiresAt,
          externalId: currentExternalId || null,
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onUpdate(await res.json())
    } catch (err) {
      setSaveError(String(err))
    } finally {
      setSaving(false)
    }
  }

  function copyField(value: string) {
    navigator.clipboard.writeText(value)
  }

  function copyAll() {
    const parts: string[] = []
    for (const spec of platform?.fields ?? []) {
      const v = fieldsRef.current[spec.name] ?? ''
      parts.push(`${spec.label}: ${v}`)
    }
    if (askingPriceRef.current != null) parts.push(`Asking Price: ${askingPriceRef.current}`)
    navigator.clipboard.writeText(parts.join('\n'))
  }

  const statusColor = listing.status === 'ACTIVE' ? '#2e7d32' : listing.status === 'SOLD' ? '#1565c0' : '#555'

  return (
    <div>
      {showMarkPosted && (
        <MarkPostedModal
          listingId={listing.id}
          initialExternalId={externalIdRef.current}
          onClose={() => setShowMarkPosted(false)}
          onPosted={l => { onUpdate(l); setShowMarkPosted(false) }}
        />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{
          padding: '2px 10px',
          borderRadius: 12,
          background: listing.status === 'DRAFT' ? '#eee' : '#c8e6c9',
          color: statusColor,
          fontSize: 13,
          fontWeight: 600,
        }}>
          {listing.status}
        </span>
        <button onClick={copyAll}>Copy All</button>
        {listing.status === 'DRAFT' && (
          <button
            onClick={() => setShowMarkPosted(true)}
            style={{ background: '#388e3c', color: '#fff', border: 'none', padding: '4px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
          >
            Mark as Posted
          </button>
        )}
        {saving && <span style={{ color: '#888', fontSize: 13 }}>Saving…</span>}
        {saveError && <span style={{ color: 'red', fontSize: 13 }}>{saveError}</span>}
      </div>

      {(platform?.fields ?? []).map(spec => {
        const value = fields[spec.name] ?? ''
        const isUncertain = fields[spec.name + '_uncertain'] === 'true'
        return (
          <div key={spec.name} style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              {spec.label}
              {isUncertain && (
                <span style={{ marginLeft: 6, fontSize: 11, color: '#a07800', background: '#fffbcc', padding: '1px 5px', borderRadius: 4 }}>
                  uncertain
                </span>
              )}
            </label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <FieldInput
                spec={spec}
                value={value}
                isUncertain={isUncertain}
                onChange={v => {
                  const next = { ...fieldsRef.current, [spec.name]: v }
                  fieldsRef.current = next
                  setFields(next)
                }}
                onBlur={v => {
                  const next = { ...fieldsRef.current, [spec.name]: v }
                  fieldsRef.current = next
                  setFields(next)
                  save(next, askingPriceRef.current, notesRef.current, postedAtRef.current, expiresAtRef.current, externalIdRef.current)
                }}
              />
              <button onClick={() => copyField(value)} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Copy</button>
            </div>
          </div>
        )
      })}

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Asking Price</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="number"
            value={askingPrice ?? ''}
            style={{ width: 120, padding: 4 }}
            onChange={e => {
              const v = e.target.value === '' ? null : Number(e.target.value)
              askingPriceRef.current = v
              setAskingPrice(v)
            }}
            onBlur={e => {
              const v = e.target.value === '' ? null : Number(e.target.value)
              askingPriceRef.current = v
              setAskingPrice(v)
              save(fieldsRef.current, v, notesRef.current, postedAtRef.current, expiresAtRef.current, externalIdRef.current)
            }}
          />
          <button onClick={() => copyField(askingPrice != null ? String(askingPrice) : '')}>Copy</button>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Notes</label>
        <textarea
          value={notes}
          style={{ width: '100%', minHeight: 60, padding: 4, boxSizing: 'border-box', resize: 'vertical' }}
          onChange={e => {
            notesRef.current = e.target.value
            setNotes(e.target.value)
          }}
          onBlur={e => {
            notesRef.current = e.target.value
            setNotes(e.target.value)
            save(fieldsRef.current, askingPriceRef.current, e.target.value, postedAtRef.current, expiresAtRef.current, externalIdRef.current)
          }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Posted date</label>
        <input
          type="date"
          value={postedAt}
          style={{ padding: 4 }}
          onChange={e => { postedAtRef.current = e.target.value; setPostedAt(e.target.value) }}
          onBlur={() => saveAll()}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Expiry date</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date"
            value={expiresAt}
            style={{ padding: 4 }}
            onChange={e => {
              const v = e.target.value
              expiresAtRef.current = v
              setExpiresAt(v)
              setExpiresAtDays(v ? String(daysFromToday(v)) : '')
            }}
            onBlur={() => saveAll()}
          />
          <input
            type="number"
            value={expiresAtDays}
            placeholder="days from today"
            style={{ width: 60, padding: 4 }}
            onChange={e => {
              setExpiresAtDays(e.target.value)
              const days = parseInt(e.target.value, 10)
              if (!isNaN(days)) {
                const date = dateFromDays(days)
                expiresAtRef.current = date
                setExpiresAt(date)
              }
            }}
            onBlur={() => saveAll()}
          />
          <span style={{ fontSize: 12, color: '#888' }}>days from today</span>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>External URL</label>
        <input
          type="text"
          value={externalId}
          placeholder="https://…"
          style={{ padding: 4, width: '100%', boxSizing: 'border-box' }}
          onChange={e => { externalIdRef.current = e.target.value; setExternalId(e.target.value) }}
          onBlur={() => {
            const url = externalIdRef.current
            if (listing.status === 'DRAFT' && url) {
              const today = new Date().toISOString().slice(0, 10)
              const effectivePostedAt = postedAtRef.current || today
              const effectiveExpiresAt = expiresAtRef.current ||
                (platform?.listingDurationDays ? dateFromDays(platform.listingDurationDays) : '')
              if (!postedAtRef.current) {
                postedAtRef.current = effectivePostedAt
                setPostedAt(effectivePostedAt)
              }
              if (effectiveExpiresAt) {
                if (!expiresAtRef.current) {
                  expiresAtRef.current = effectiveExpiresAt
                  setExpiresAt(effectiveExpiresAt)
                  setExpiresAtDays(String(daysFromToday(effectiveExpiresAt)))
                }
                markPosted(effectivePostedAt, effectiveExpiresAt, url)
              } else {
                setShowMarkPosted(true)
              }
            } else {
              saveAll()
            }
          }}
        />
      </div>
    </div>
  )
}

export function ItemDetail() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<Item | null>(null)
  const [platforms, setPlatforms] = useState<PlatformProfile[]>([])
  const [activeTab, setActiveTab] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/v1/items/${id}`).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
      fetch('/api/v1/config/platforms').then(r => r.json()),
    ])
      .then(([itemData, platformsData]) => {
        setItem(itemData)
        setPlatforms(platformsData)
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>
  if (!item) return <p>Item not found.</p>

  const listings = item.listings ?? []

  return (
    <div>
      <Link to="/">← Back to list</Link>
      <h1 style={{ marginBottom: 16 }}>
        {item.rawDescription.slice(0, 80)}{item.rawDescription.length > 80 ? '…' : ''}
      </h1>

      <div style={{ display: 'flex', gap: 24 }}>
        {/* Photo sidebar */}
        <div style={{ width: 140, flexShrink: 0 }}>
          <h3 style={{ marginTop: 0, fontSize: 14 }}>Photos</h3>
          <PhotoStrip item={item} onUpdate={setItem} />
          <AddPhotos itemId={item.id} onUpdate={setItem} />
        </div>

        {/* Listings */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {listings.length === 0 ? (
            <p style={{ color: '#888' }}>No listings yet. Create the item with platforms selected to generate listings.</p>
          ) : (
            <>
              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0', marginBottom: 20 }}>
                {listings.map((listing, idx) => {
                  const platform = platforms.find(p => p.id === listing.platformId)
                  return (
                    <button
                      key={listing.id}
                      onClick={() => setActiveTab(idx)}
                      style={{
                        padding: '8px 16px',
                        border: 'none',
                        borderBottom: activeTab === idx ? '2px solid #1976d2' : '2px solid transparent',
                        marginBottom: -2,
                        background: 'none',
                        cursor: 'pointer',
                        fontWeight: activeTab === idx ? 600 : 400,
                        color: activeTab === idx ? '#1976d2' : '#555',
                        fontSize: 14,
                      }}
                    >
                      {platform?.label ?? listing.platformId}
                    </button>
                  )
                })}
              </div>

              {/* Active tab content */}
              {listings[activeTab] && (
                <ListingTab
                  key={listings[activeTab].id}
                  listing={listings[activeTab]}
                  platform={platforms.find(p => p.id === listings[activeTab].platformId)}
                  onUpdate={updatedListing => {
                    setItem(prev =>
                      prev
                        ? { ...prev, listings: prev.listings.map(l => l.id === updatedListing.id ? updatedListing : l) }
                        : prev
                    )
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
