'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { QRCodeSVG } from 'qrcode.react'

interface VoucherRecord {
  id: string
  voucher_token: string
  guest_name: string
  room_number: string
  item_count: number
  notes: string | null
  signature_url: string | null
  status: string
  created_at: string
  collected_at: string | null
}

interface VoucherPhoto {
  id: string
  photo_url: string
  uploaded_at: string
}

export default function VoucherPage() {
  const params = useParams()
  const token = params.token as string
  const [record, setRecord] = useState<VoucherRecord | null>(null)
  const [photos, setPhotos] = useState<VoucherPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: recordData, error: recordError } = await supabase
        .rpc('get_record_by_token', { p_token: token })

      if (recordError || !recordData || recordData.length === 0) {
        setError(true)
        setLoading(false)
        return
      }

      setRecord(recordData[0])

      const { data: photoData } = await supabase
        .rpc('get_photos_by_token', { p_token: token })

      setPhotos(photoData || [])
      setLoading(false)
    }
    load()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0E9E6] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#007293] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[#002F61]/50 text-sm">Loading voucher...</p>
        </div>
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="min-h-screen bg-[#F0E9E6] flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold text-[#002F61]">Voucher Not Found</h1>
          <p className="text-[#002F61]/60 text-sm">This voucher link is invalid or has expired.</p>
        </div>
      </div>
    )
  }

  const voucherUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div className="min-h-screen bg-[#F0E9E6]">
      {/* Hotel Header */}
      <header className="bg-[#002F61] text-white text-center py-6">
        <div className="max-w-lg mx-auto px-4">
          <p className="text-white/60 text-xs uppercase tracking-widest mb-1">Hilton</p>
          <h1 className="text-xl font-bold">Luggage Storage Voucher</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Status */}
        <div className={`text-center py-3 rounded-2xl font-medium text-sm ${
          record.status === 'stored'
            ? 'bg-[#007293]/10 text-[#007293]'
            : 'bg-green-100 text-green-700'
        }`}>
          {record.status === 'stored' ? '📦 Your luggage is safely stored' : '✅ Luggage has been collected'}
        </div>

        {/* Voucher Info */}
        <div className="glass-card p-6 space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-[#002F61]/10">
              <span className="text-[#002F61]/60">Guest</span>
              <span className="font-medium text-[#002F61]">{record.guest_name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#002F61]/10">
              <span className="text-[#002F61]/60">Room</span>
              <span className="font-medium text-[#002F61]">{record.room_number}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#002F61]/10">
              <span className="text-[#002F61]/60">Items</span>
              <span className="font-medium text-[#002F61]">{record.item_count} item{record.item_count > 1 ? 's' : ''}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[#002F61]/10">
              <span className="text-[#002F61]/60">Stored at</span>
              <span className="font-medium text-[#002F61]">{new Date(record.created_at).toLocaleString()}</span>
            </div>
            {record.collected_at && (
              <div className="flex justify-between py-2 border-b border-[#002F61]/10">
                <span className="text-[#002F61]/60">Collected at</span>
                <span className="font-medium text-[#002F61]">{new Date(record.collected_at).toLocaleString()}</span>
              </div>
            )}
            {record.notes && (
              <div className="flex justify-between py-2">
                <span className="text-[#002F61]/60">Notes</span>
                <span className="font-medium text-[#002F61] text-right max-w-[60%]">{record.notes}</span>
              </div>
            )}
          </div>
        </div>

        {/* Photos */}
        {photos.length > 0 && (
          <div className="glass-card p-6 space-y-3">
            <h3 className="font-semibold text-[#002F61] text-sm">Your Luggage</h3>
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo) => (
                <img
                  key={photo.id}
                  src={photo.photo_url}
                  alt="Luggage"
                  className="w-full h-36 object-cover rounded-xl border border-[#002F61]/10"
                />
              ))}
            </div>
          </div>
        )}

        {/* QR Code for collection */}
        {record.status === 'stored' && (
          <div className="glass-card p-6 text-center space-y-4">
            <h3 className="font-semibold text-[#002F61] text-sm">Present this to collect your luggage</h3>
            <div className="inline-block p-4 bg-white rounded-2xl">
              <QRCodeSVG
                value={voucherUrl}
                size={180}
                level="M"
                fgColor="#002F61"
              />
            </div>
            <p className="text-xs text-[#002F61]/40">
              Show this QR code to the front desk when you&apos;re ready to collect
            </p>
          </div>
        )}

        {/* Signature */}
        {record.signature_url && (
          <div className="glass-card p-6 space-y-3">
            <h3 className="font-semibold text-[#002F61] text-sm">Your Signature</h3>
            <div className="bg-white rounded-xl p-3 border border-[#002F61]/10">
              <img src={record.signature_url} alt="Your signature" className="h-16 mx-auto" />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-[#002F61]/30">
            Bookmark this page to access your voucher anytime
          </p>
        </div>
      </div>
    </div>
  )
}
