import { NextRequest, NextResponse } from 'next/server'

const GLM_OCR_API = 'https://open.bigmodel.cn/api/paas/v4/layout_parsing'

interface OcrResult {
  guest_name: string
  room_number: string
  item_count: number
  phone: string
  storage_date: string
  collection_date: string
  raw_text: string
}

/**
 * Parse OCR markdown text to extract luggage tag fields.
 * Tag fields: 房间号, 行李数量, 寄存日期, 领取日期, 电话, 客人签名, 办理人签名
 * Signatures are visual (handwritten) — not extracted as text.
 */
function parseLuggageTag(text: string): OcrResult {
  const result: OcrResult = {
    guest_name: '',
    room_number: '',
    item_count: 1,
    phone: '',
    storage_date: '',
    collection_date: '',
    raw_text: text,
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    // Skip staff signature lines (办理人签名) — not useful data
    if (/(?:办理人|staff|员工|前台)\s*(?:签名|signature)/i.test(line)) continue

    // Guest name: extract from 客人签名 / 姓名 / Guest Name
    if (!result.guest_name) {
      // "客人签名：张三" → guest name is "张三"
      let match = line.match(/(?:客人签名|guest\s*signature)\s*[:\s：]*\s*(.+)/i)
      if (match) { result.guest_name = match[1].trim().replace(/[|│\s]+$/, ''); continue }
      match = line.match(/(?:guest\s*name|姓名|客人姓名)\s*[:\s：]*\s*(.+)/i)
      if (match) { result.guest_name = match[1].trim().replace(/[|│\s]+$/, ''); continue }
      match = line.match(/^((?:Mr|Mrs|Ms|Miss|Dr)\.?\s+.+)/i)
      if (match) { result.guest_name = match[1].trim(); continue }
    }

    // Room number: 房间号 / Room / Rm
    if (!result.room_number) {
      let match = line.match(/(?:room\s*(?:no\.?|number|#)?|房间号?|房号)\s*[:\s：]*\s*(\d{2,5}[A-Za-z]?)/i)
      if (match) { result.room_number = match[1]; continue }
      match = line.match(/(?:rm|room)\s*[.:\s]*(\d{2,5}[A-Za-z]?)/i)
      if (match) { result.room_number = match[1]; continue }
    }

    // Item count: 行李数量 / 件数 / Items / Pieces
    {
      let match = line.match(/(?:行李数量|件数|数量|items?\s*(?:count)?|pieces?|luggage\s*(?:count)?)\s*[:\s：]*\s*(\d+)/i)
      if (match) { result.item_count = parseInt(match[1], 10) || 1; continue }
      match = line.match(/(\d+)\s*(?:items?|pieces?|pcs?|件)/i)
      if (match) { result.item_count = parseInt(match[1], 10) || 1; continue }
    }

    // Phone: 电话 / Tel / Phone / Mobile
    if (!result.phone) {
      let match = line.match(/(?:电话|手机|联系方式|tel(?:ephone)?|phone|mobile|cell)\s*[:\s：]*\s*([\d\s\-+()]+)/i)
      if (match) {
        result.phone = match[1].replace(/\s+/g, '').trim()
        continue
      }
      // Standalone phone number pattern (10-13 digits, may start with +)
      match = line.match(/^[+]?\d[\d\s\-]{8,15}$/)
      if (match) {
        result.phone = match[0].replace(/\s+/g, '').trim()
        continue
      }
    }

    // Storage date: 寄存日期 / Check-in Date / Storage Date / Date In
    if (!result.storage_date) {
      const match = line.match(/(?:寄存日期|存放日期|存入日期|storage\s*date|check.?in\s*date|date\s*in|入住日期)\s*[:\s：]*\s*(.+)/i)
      if (match) {
        result.storage_date = match[1].trim().replace(/[|│\s]+$/, '')
        continue
      }
    }

    // Collection date: 领取日期 / Pickup Date / Collection Date / Date Out
    if (!result.collection_date) {
      const match = line.match(/(?:领取日期|取件日期|提取日期|pickup\s*date|collection\s*date|date\s*out|退房日期|check.?out\s*date)\s*[:\s：]*\s*(.+)/i)
      if (match) {
        result.collection_date = match[1].trim().replace(/[|│\s]+$/, '')
        continue
      }
    }

    // Generic date line — try to assign to storage_date if not yet set
    if (!result.storage_date) {
      const match = line.match(/(?:日期|date)\s*[:\s：]*\s*(.+)/i)
      if (match) {
        result.storage_date = match[1].trim().replace(/[|│\s]+$/, '')
        continue
      }
    }
  }

  return result
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GLM_OCR_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GLM_OCR_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be under 10MB' },
        { status: 400 }
      )
    }

    // Convert file to base64 data URI for GLM-OCR API
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const dataUri = `data:${file.type};base64,${base64}`

    // Call GLM-OCR API (synchronous, no polling needed)
    const res = await fetch(GLM_OCR_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'glm-ocr',
        file: dataUri,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('GLM-OCR API error:', res.status, errText)
      return NextResponse.json(
        { error: 'OCR service error' },
        { status: 502 }
      )
    }

    const data = await res.json()
    const markdown = data.md_results || ''
    const parsed = parseLuggageTag(markdown)

    return NextResponse.json({
      success: true,
      data: parsed,
    })
  } catch (err) {
    console.error('OCR route error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
