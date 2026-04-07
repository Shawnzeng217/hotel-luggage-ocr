'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import PhotoCapture from '@/components/PhotoCapture'
import SignaturePad from '@/components/SignaturePad'

type Step = 'info' | 'photos' | 'signature' | 'confirm'

export default function NewCheckInPage() {
  const [step, setStep] = useState<Step>('info')
  const [guestName, setGuestName] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [itemCount, setItemCount] = useState(1)
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const previewUrls = useMemo(
    () => photos.map((f) => URL.createObjectURL(f)),
    [photos]
  )

  const handlePhotoCapture = (newFiles: File[]) => {
    setPhotos((prev) => [...prev, ...newFiles])
  }

  const handlePhotoRemove = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const voucherToken = uuidv4()

      // Upload signature
      let signatureUrl: string | null = null
      if (signatureData) {
        const signatureBlob = await fetch(signatureData).then(r => r.blob())
        const signaturePath = `${voucherToken}/signature.png`
        const { error: sigError } = await supabase.storage
          .from('signatures')
          .upload(signaturePath, signatureBlob, { contentType: 'image/png' })

        if (!sigError) {
          const { data: urlData } = supabase.storage
            .from('signatures')
            .getPublicUrl(signaturePath)
          signatureUrl = urlData.publicUrl
        }
      }

      // Insert luggage record
      const { data: record, error: recordError } = await supabase
        .from('luggage_records')
        .insert({
          voucher_token: voucherToken,
          guest_name: guestName,
          room_number: roomNumber,
          item_count: itemCount,
          notes: notes || null,
          signature_url: signatureUrl,
          status: 'stored',
          created_by: user.id,
        })
        .select()
        .single()

      if (recordError) throw recordError

      // Upload photos
      for (let i = 0; i < photos.length; i++) {
        const file = photos[i]
        const ext = file.name.split('.').pop() || 'jpg'
        const photoPath = `${voucherToken}/photo_${i}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('luggage-photos')
          .upload(photoPath, file, { contentType: file.type })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('luggage-photos')
            .getPublicUrl(photoPath)

          await supabase.from('luggage_photos').insert({
            record_id: record.id,
            photo_url: urlData.publicUrl,
          })
        }
      }

      router.push(`/dashboard/success/${voucherToken}`)
    } catch (err) {
      console.error('Submit error:', err)
      alert('Failed to create record. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F0E9E6]">
      {/* Header */}
      <header className="bg-[#002F61] text-white">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-white/70 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold">New Check-in</h1>
            <p className="text-white/60 text-xs">
              Step {step === 'info' ? '1' : step === 'photos' ? '2' : step === 'signature' ? '3' : '4'} of 4
            </p>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex gap-1">
          {(['info', 'photos', 'signature', 'confirm'] as Step[]).map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition ${
              i <= ['info', 'photos', 'signature', 'confirm'].indexOf(step)
                ? 'bg-[#007293]'
                : 'bg-[#002F61]/10'
            }`} />
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Step 1: Guest Info */}
        {step === 'info' && (
          <div className="glass-card p-6 space-y-5">
            <h2 className="text-lg font-semibold text-[#002F61]">Guest Information</h2>

            <div>
              <label className="block text-sm font-medium text-[#002F61] mb-1.5">Room Number</label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. 1208"
                className="w-full px-4 py-3 rounded-xl border border-[#002F61]/10 bg-white/80 text-[#002F61] placeholder:text-[#002F61]/30 focus:outline-none focus:ring-2 focus:ring-[#007293] transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#002F61] mb-1.5">Guest Name</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full px-4 py-3 rounded-xl border border-[#002F61]/10 bg-white/80 text-[#002F61] placeholder:text-[#002F61]/30 focus:outline-none focus:ring-2 focus:ring-[#007293] transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#002F61] mb-1.5">Number of Items</label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setItemCount(Math.max(1, itemCount - 1))}
                  className="w-10 h-10 rounded-xl border border-[#002F61]/10 flex items-center justify-center text-[#002F61] hover:bg-[#002F61]/5"
                >
                  −
                </button>
                <span className="text-2xl font-bold text-[#002F61] w-8 text-center">{itemCount}</span>
                <button
                  type="button"
                  onClick={() => setItemCount(itemCount + 1)}
                  className="w-10 h-10 rounded-xl border border-[#002F61]/10 flex items-center justify-center text-[#002F61] hover:bg-[#002F61]/5"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#002F61] mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Scratch on left side of red suitcase"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-[#002F61]/10 bg-white/80 text-[#002F61] placeholder:text-[#002F61]/30 focus:outline-none focus:ring-2 focus:ring-[#007293] transition resize-none"
              />
            </div>

            <button
              onClick={() => setStep('photos')}
              disabled={!guestName || !roomNumber}
              className="w-full py-3 bg-[#007293] text-white font-medium rounded-xl hover:bg-[#007293]/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Take Photos →
            </button>
          </div>
        )}

        {/* Step 2: Photos */}
        {step === 'photos' && (
          <div className="glass-card p-6 space-y-5">
            <h2 className="text-lg font-semibold text-[#002F61]">Luggage Photos</h2>
            <p className="text-sm text-[#002F61]/60">
              Take photos of each luggage item for the record.
            </p>

            <PhotoCapture
              photos={photos}
              previewUrls={previewUrls}
              onCapture={handlePhotoCapture}
              onRemove={handlePhotoRemove}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setStep('info')}
                className="flex-1 py-3 border border-[#002F61]/20 text-[#002F61] font-medium rounded-xl hover:bg-[#002F61]/5 transition"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep('signature')}
                disabled={photos.length === 0}
                className="flex-1 py-3 bg-[#007293] text-white font-medium rounded-xl hover:bg-[#007293]/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Signature →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Signature */}
        {step === 'signature' && (
          <div className="space-y-5">
            {/* Confirmation message */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-semibold text-[#002F61] mb-3">Guest Confirmation</h2>
              <div className="bg-[#002F61]/5 rounded-xl p-4 text-sm text-[#002F61]">
                <p className="font-medium mb-2">Please confirm:</p>
                <p>
                  I, <strong>{guestName}</strong>, confirm the storage of{' '}
                  <strong>{itemCount} item{itemCount > 1 ? 's' : ''}</strong> from
                  Room <strong>{roomNumber}</strong>. I acknowledge that the photos taken
                  accurately represent the current condition of my luggage.
                </p>
              </div>
            </div>

            {/* Signature area - designed for handing device to guest */}
            <div className="glass-card p-6">
              <div className="text-center mb-4">
                <p className="text-[#007293] font-medium text-lg">✍️ Please Sign Below</p>
                <p className="text-sm text-[#002F61]/50">Hand device to guest for signature</p>
              </div>

              <SignaturePad
                onSave={(data) => {
                  setSignatureData(data)
                  setStep('confirm')
                }}
                onClear={() => setSignatureData(null)}
              />
            </div>

            <button
              onClick={() => setStep('photos')}
              className="w-full py-3 border border-[#002F61]/20 text-[#002F61] font-medium rounded-xl hover:bg-[#002F61]/5 transition"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Step 4: Confirm & Submit */}
        {step === 'confirm' && (
          <div className="glass-card p-6 space-y-5">
            <h2 className="text-lg font-semibold text-[#002F61]">Review & Submit</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-[#002F61]/10">
                <span className="text-[#002F61]/60">Guest</span>
                <span className="font-medium text-[#002F61]">{guestName}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#002F61]/10">
                <span className="text-[#002F61]/60">Room</span>
                <span className="font-medium text-[#002F61]">{roomNumber}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#002F61]/10">
                <span className="text-[#002F61]/60">Items</span>
                <span className="font-medium text-[#002F61]">{itemCount}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#002F61]/10">
                <span className="text-[#002F61]/60">Photos</span>
                <span className="font-medium text-[#002F61]">{photos.length} taken</span>
              </div>
              {notes && (
                <div className="flex justify-between py-2 border-b border-[#002F61]/10">
                  <span className="text-[#002F61]/60">Notes</span>
                  <span className="font-medium text-[#002F61] text-right max-w-[60%]">{notes}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-[#002F61]/10">
                <span className="text-[#002F61]/60">Signature</span>
                <span className="font-medium text-green-600">✓ Captured</span>
              </div>
            </div>

            {/* Photo thumbnails */}
            <div className="grid grid-cols-3 gap-2">
              {previewUrls.map((url, i) => (
                <img key={i} src={url} alt={`Photo ${i + 1}`}
                  className="w-full h-20 object-cover rounded-lg border border-[#002F61]/10" />
              ))}
            </div>

            {/* Signature preview */}
            {signatureData && (
              <div className="border border-[#002F61]/10 rounded-xl p-2 bg-white">
                <img src={signatureData} alt="Signature" className="h-16 mx-auto" />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('signature')}
                className="flex-1 py-3 border border-[#002F61]/20 text-[#002F61] font-medium rounded-xl hover:bg-[#002F61]/5 transition"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 bg-[#002F61] text-white font-medium rounded-xl hover:bg-[#002F61]/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating...' : 'Confirm Check-in ✓'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
