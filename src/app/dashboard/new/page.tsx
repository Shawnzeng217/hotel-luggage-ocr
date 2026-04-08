'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'
import PhotoCapture from '@/components/PhotoCapture'
import LuggageTagScan from '@/components/LuggageTagScan'

type Step = 'scan' | 'info' | 'photos' | 'confirm'
const STEPS: Step[] = ['scan', 'info', 'photos', 'confirm']

export default function NewCheckInPage() {
  const [step, setStep] = useState<Step>('scan')
  const [ocrUsed, setOcrUsed] = useState(false)
  const [tagImageUrl, setTagImageUrl] = useState<string | null>(null)
  const [roomNumber, setRoomNumber] = useState('')
  const [guestName, setGuestName] = useState('')
  const [itemCount, setItemCount] = useState(1)
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  const router = useRouter()
  const supabase = createClient()

  const previewUrls = useMemo(
    () => photos.map((f) => URL.createObjectURL(f)),
    [photos]
  )

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [previewUrls])

  const handlePhotoCapture = (newFiles: File[]) => {
    setPhotos((prev) => [...prev, ...newFiles])
  }

  const handlePhotoRemove = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const stepIndex = STEPS.indexOf(step)

  const handleSubmit = async () => {
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const voucherToken = uuidv4()

      // Upload tag image as signature proof (if scanned)
      let signatureUrl: string | null = null
      if (tagImageUrl) {
        setUploadProgress('Uploading tag image...')
        const tagBlob = await fetch(tagImageUrl).then(r => r.blob())
        const tagPath = `${voucherToken}/tag.jpg`
        const { error: tagError } = await supabase.storage
          .from('signatures')
          .upload(tagPath, tagBlob, { contentType: 'image/jpeg' })

        if (!tagError) {
          const { data: urlData } = supabase.storage
            .from('signatures')
            .getPublicUrl(tagPath)
          signatureUrl = urlData.publicUrl
        }
      }

      // Insert luggage record
      setUploadProgress('Creating record...')
      const { data: record, error: recordError } = await supabase
        .from('luggage_records')
        .insert({
          voucher_token: voucherToken,
          guest_name: guestName || '',
          room_number: roomNumber,
          item_count: itemCount,
          phone: phone || null,
          notes: notes || null,
          signature_url: signatureUrl,
          status: 'stored',
          created_by: user.id,
        })
        .select()
        .single()

      if (recordError) throw recordError

      // Upload photos
      const failedUploads: number[] = []
      for (let i = 0; i < photos.length; i++) {
        setUploadProgress(`Uploading photo ${i + 1} of ${photos.length}...`)
        const file = photos[i]
        const ext = file.name.split('.').pop() || 'jpg'
        const photoPath = `${voucherToken}/photo_${i}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('luggage-photos')
          .upload(photoPath, file, { contentType: file.type })

        if (uploadError) {
          failedUploads.push(i + 1)
          continue
        }

        const { data: urlData } = supabase.storage
          .from('luggage-photos')
          .getPublicUrl(photoPath)

        await supabase.from('luggage_photos').insert({
          record_id: record.id,
          photo_url: urlData.publicUrl,
        })
      }

      if (failedUploads.length > 0) {
        alert(`Warning: Photo(s) #${failedUploads.join(', ')} failed to upload.`)
      }

      setUploadProgress('')
      router.push(`/dashboard/success/${voucherToken}`)
    } catch (err) {
      console.error('Submit error:', err)
      alert('Failed to create record. Please try again.')
      setUploadProgress('')
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
            <h1 className="text-lg font-bold">New Check-in / 新寄存</h1>
            <p className="text-white/60 text-xs">
              Step {stepIndex + 1} of {STEPS.length}
            </p>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition ${
              i <= stepIndex ? 'bg-[#007293]' : 'bg-[#002F61]/10'
            }`} />
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* ========== Step 1: Scan Luggage Tag ========== */}
        {step === 'scan' && (
          <div className="glass-card p-6 space-y-5">
            <h2 className="text-lg font-semibold text-[#002F61]">
              Scan Luggage Tag / 扫描行李卡
            </h2>
            <p className="text-sm text-[#002F61]/60">
              Take a photo of the luggage tag to auto-extract info, or skip to enter manually.
            </p>
            <p className="text-xs text-[#002F61]/40">
              拍摄行李卡照片自动提取信息，或跳过手动输入。
            </p>

            <LuggageTagScan
              onResult={(result) => {
                setRoomNumber(result.room_number || '')
                setGuestName(result.guest_name || '')
                setItemCount(result.item_count || 1)
                setPhone(result.phone || '')
                setTagImageUrl(result.tag_image_url || null)
                setOcrUsed(true)
                setStep('info')
              }}
              onSkip={() => setStep('info')}
            />
          </div>
        )}

        {/* ========== Step 2: Confirm / Edit Info ========== */}
        {step === 'info' && (
          <div className="glass-card p-6 space-y-5">
            <h2 className="text-lg font-semibold text-[#002F61]">
              Guest Information / 客人信息
            </h2>
            {ocrUsed && (
              <div className="bg-green-50 text-green-700 text-sm p-3 rounded-xl flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Auto-filled from tag — please verify / 已自动识别，请核实
              </div>
            )}

            {/* Room Number */}
            <div>
              <label className="block text-sm font-medium text-[#002F61] mb-1.5">
                Room Number / 房间号 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. 1208"
                className="w-full px-4 py-3 rounded-xl border border-[#002F61]/10 bg-white/80 text-[#002F61] placeholder:text-[#002F61]/30 focus:outline-none focus:ring-2 focus:ring-[#007293] transition"
              />
            </div>

            {/* Guest Name */}
            <div>
              <label className="block text-sm font-medium text-[#002F61] mb-1.5">
                Guest Name / 客人姓名
              </label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. John Smith (optional)"
                className="w-full px-4 py-3 rounded-xl border border-[#002F61]/10 bg-white/80 text-[#002F61] placeholder:text-[#002F61]/30 focus:outline-none focus:ring-2 focus:ring-[#007293] transition"
              />
            </div>

            {/* Item Count */}
            <div>
              <label className="block text-sm font-medium text-[#002F61] mb-1.5">
                Number of Items / 行李数量 <span className="text-red-400">*</span>
              </label>
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

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-[#002F61] mb-1.5">
                Phone / 电话
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 13800138000"
                className="w-full px-4 py-3 rounded-xl border border-[#002F61]/10 bg-white/80 text-[#002F61] placeholder:text-[#002F61]/30 focus:outline-none focus:ring-2 focus:ring-[#007293] transition"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-[#002F61] mb-1.5">
                Notes / 备注
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Red suitcase, fragile / 红色行李箱，易碎"
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-[#002F61]/10 bg-white/80 text-[#002F61] placeholder:text-[#002F61]/30 focus:outline-none focus:ring-2 focus:ring-[#007293] transition resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('scan')}
                className="flex-1 py-3 border border-[#002F61]/20 text-[#002F61] font-medium rounded-xl hover:bg-[#002F61]/5 transition"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep('photos')}
                disabled={!roomNumber}
                className="flex-1 py-3 bg-[#007293] text-white font-medium rounded-xl hover:bg-[#007293]/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Photos →
              </button>
            </div>
          </div>
        )}

        {/* ========== Step 3: Photos ========== */}
        {step === 'photos' && (
          <div className="glass-card p-6 space-y-5">
            <h2 className="text-lg font-semibold text-[#002F61]">
              Luggage Photos / 行李拍照
            </h2>
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
                onClick={() => setStep('confirm')}
                disabled={photos.length === 0}
                className="flex-1 py-3 bg-[#007293] text-white font-medium rounded-xl hover:bg-[#007293]/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Confirm →
              </button>
            </div>
          </div>
        )}

        {/* ========== Step 4: Confirm & Submit ========== */}
        {step === 'confirm' && (
          <div className="glass-card p-6 space-y-5">
            <h2 className="text-lg font-semibold text-[#002F61]">
              Review & Submit / 确认提交
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-[#002F61]/10">
                <span className="text-[#002F61]/60">Room / 房间</span>
                <span className="font-medium text-[#002F61]">{roomNumber}</span>
              </div>
              {guestName && (
                <div className="flex justify-between py-2 border-b border-[#002F61]/10">
                  <span className="text-[#002F61]/60">Guest / 客人</span>
                  <span className="font-medium text-[#002F61]">{guestName}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-[#002F61]/10">
                <span className="text-[#002F61]/60">Items / 件数</span>
                <span className="font-medium text-[#002F61]">{itemCount}</span>
              </div>
              {phone && (
                <div className="flex justify-between py-2 border-b border-[#002F61]/10">
                  <span className="text-[#002F61]/60">Phone / 电话</span>
                  <span className="font-medium text-[#002F61]">{phone}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-[#002F61]/10">
                <span className="text-[#002F61]/60">Photos / 照片</span>
                <span className="font-medium text-[#002F61]">{photos.length} taken</span>
              </div>
              {notes && (
                <div className="flex justify-between py-2 border-b border-[#002F61]/10">
                  <span className="text-[#002F61]/60">Notes / 备注</span>
                  <span className="font-medium text-[#002F61] text-right max-w-[60%]">{notes}</span>
                </div>
              )}
              {tagImageUrl && (
                <div className="flex justify-between py-2 border-b border-[#002F61]/10">
                  <span className="text-[#002F61]/60">Tag scanned / 行李卡</span>
                  <span className="font-medium text-green-600">✓ Captured</span>
                </div>
              )}
            </div>

            {/* Photo thumbnails */}
            <div className="grid grid-cols-3 gap-2">
              {previewUrls.map((url, i) => (
                <img key={i} src={url} alt={`Photo ${i + 1}`}
                  className="w-full h-20 object-cover rounded-lg border border-[#002F61]/10" />
              ))}
            </div>

            {/* Tag image preview */}
            {tagImageUrl && (
              <div className="border border-[#002F61]/10 rounded-xl p-2 bg-white">
                <p className="text-xs text-[#002F61]/40 mb-1 text-center">Luggage Tag / 行李卡</p>
                <img src={tagImageUrl} alt="Luggage tag" className="h-24 mx-auto object-contain" />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('photos')}
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

        {/* Upload progress overlay */}
        {submitting && (
          <div className="fixed inset-0 z-50 bg-[#002F61]/60 flex items-center justify-center px-6">
            <div className="glass-card p-8 w-full max-w-sm text-center space-y-4">
              <div className="w-12 h-12 border-3 border-[#007293] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-lg font-semibold text-[#002F61]">Creating Record...</p>
              <p className="text-sm text-[#002F61]/60">{uploadProgress || 'Preparing...'}</p>
              <p className="text-xs text-[#002F61]/40">Please do not close this page</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
