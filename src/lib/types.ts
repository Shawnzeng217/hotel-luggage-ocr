export interface LuggageRecord {
  id: string
  voucher_token: string
  guest_name: string
  room_number: string
  item_count: number
  phone: string | null
  notes: string | null
  signature_url: string | null
  status: 'stored' | 'collected'
  created_by: string | null
  created_at: string
  collected_at: string | null
}

export interface LuggagePhoto {
  id: string
  record_id: string
  photo_url: string
  uploaded_at: string
}
