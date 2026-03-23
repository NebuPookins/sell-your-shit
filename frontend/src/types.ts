export interface PriceHistoryEntry {
  price: number
  reason: string
  date: string
}

export interface Listing {
  id: string
  platformId: string
  status: 'DRAFT' | 'ACTIVE' | 'SOLD' | 'CANCELLED'
  generatedFields: Record<string, string>
  askingPrice: number | null
  notes: string
  createdAt: string
  updatedAt: string
  postedAt: string | null
  expiresAt: string | null
  externalId: string | null
  priceHistory: PriceHistoryEntry[]
}

export interface Item {
  id: string
  rawDescription: string
  minimumPrice: number
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  listings: Listing[]
  photos: string[]
}
