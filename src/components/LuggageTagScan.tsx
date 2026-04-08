'use client'

import { useRef, useState } from 'react'

interface ScanResult {
  guest_name: string
  room_number: string
  item_count: number
  phone: string
  storage_date: string
  collection_date: string
  raw_text: string
  tag_image_url: string | null
}

interface Props {
  onResult: (result: ScanResult) => void
  onSkip: () => void
}

export default function LuggageTagScan({ onResult, onSkip }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setPreview(url)
    setError('')
    setScanning(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to recognize luggage tag')
        setScanning(false)
        return
      }

      // Keep URL alive — parent uses as tag signature proof
      onResult({ ...data.data, tag_image_url: url })
    } catch {
      setError('Network error. Please try again.')
      URL.revokeObjectURL(url)
    } finally {
      setScanning(false)
    }

    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="space-y-5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="hidden"
      />

      {/* Preview */}
      {preview && (
        <div className="relative">
          <img
            src={preview}
            alt="Luggage tag"
            className="w-full h-48 object-contain rounded-xl border border-[#002F61]/10 bg-white"
          />
          {scanning && (
            <div className="absolute inset-0 bg-white/80 rounded-xl flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-[#007293] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#002F61] font-medium">
                Recognizing tag info...
              </p>
              <p className="text-xs text-[#002F61]/50">识别行李卡信息中...</p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Scan Button */}
      {!scanning && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full py-12 border-2 border-dashed border-[#007293]/30 rounded-2xl flex flex-col items-center gap-3 text-[#007293] hover:border-[#007293] hover:bg-[#007293]/5 active:bg-[#007293]/10 transition-colors"
        >
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
          <div className="text-center">
            <p className="font-medium text-base">
              {preview ? 'Retry Scan / 重新扫描' : 'Scan Luggage Tag / 扫描行李卡'}
            </p>
            <p className="text-xs text-[#002F61]/40 mt-1">
              Take a photo to auto-extract info / 拍照自动提取信息
            </p>
          </div>
        </button>
      )}

      {/* Skip — manual entry */}
      {!scanning && (
        <button
          type="button"
          onClick={onSkip}
          className="w-full py-3 border border-[#002F61]/20 text-[#002F61]/60 font-medium rounded-xl hover:bg-[#002F61]/5 transition text-sm"
        >
          Skip — Enter Manually / 跳过 — 手动输入
        </button>
      )}
    </div>
  )
}
