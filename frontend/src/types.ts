export interface FieldSpec {
  name: string
  label: string
  type: 'text' | 'number' | 'enum' | 'multiline'
  'max-length'?: number
  values?: string[]
}

export interface PlatformProfile {
  id: string
  label: string
  fields: FieldSpec[]
  listingDurationDays?: number
}

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
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  listings: Listing[]
  photos: string[]
}

export interface DashboardEntry {
  itemId: string
  itemDescription: string
  itemThumbnail: string | null
  listingId: string
  platformId: string
  title: string | null
  askingPrice: number | null
  postedAt: string | null
  expiresAt: string | null
  daysActive: number | null
  renewalReason: string | null
}

export interface DashboardResponse {
  renewalQueue: DashboardEntry[]
  activeListings: DashboardEntry[]
  closedItems: Item[]
}
