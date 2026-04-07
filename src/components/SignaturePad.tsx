'use client'

import { useRef, useEffect, useState } from 'react'
import SignaturePadLib from 'signature_pad'

interface Props {
  onSave: (dataUrl: string) => void
  onClear?: () => void
}

export default function SignaturePad({ onSave, onClear }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadLib | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * ratio
      canvas.height = rect.height * ratio
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.scale(ratio, ratio)
      if (padRef.current) padRef.current.clear()
    }

    padRef.current = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
    })

    padRef.current.addEventListener('endStroke', () => {
      setIsEmpty(padRef.current?.isEmpty() ?? true)
    })

    resize()
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      padRef.current?.off()
    }
  }, [])

  const handleClear = () => {
    padRef.current?.clear()
    setIsEmpty(true)
    onClear?.()
  }

  const handleSave = () => {
    if (padRef.current && !padRef.current.isEmpty()) {
      onSave(padRef.current.toDataURL('image/png'))
    }
  }

  return (
    <div className="space-y-3">
      <div className="border-2 border-dashed border-[#002F61]/20 rounded-2xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full touch-none"
          style={{ height: '250px' }}
        />
      </div>
      <p className="text-sm text-[#002F61]/50 text-center">Please sign above / 请在上方签名</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleClear}
          className="flex-1 px-4 py-3 border border-[#002F61]/20 rounded-xl text-[#002F61] hover:bg-[#002F61]/5 active:bg-[#002F61]/10 transition"
        >
          Clear / 清除
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isEmpty}
          className="flex-1 px-4 py-3 bg-[#007293] text-white rounded-xl hover:bg-[#007293]/90 active:bg-[#007293]/80 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          Confirm / 确认签名
        </button>
      </div>
    </div>
  )
}
