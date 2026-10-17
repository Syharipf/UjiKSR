import type { Session } from '@/lib/exam'
import { formatDate } from '@/lib/exam'
import type { RecapRow } from '@/lib/report'
import { progressPairs } from '@/lib/report'
import fontkit from '@pdf-lib/fontkit'
import type { PDFFont, PDFPage } from 'pdf-lib'
import { PDFDocument, rgb } from 'pdf-lib'

export interface RaporAssets {
  logoPng: Uint8Array | ArrayBuffer
  fontRegular: Uint8Array | ArrayBuffer
  fontBold: Uint8Array | ArrayBuffer
  fontDisplay: Uint8Array | ArrayBuffer
}

// A4 dimensions in pt: 210 x 297 mm
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN = 51 // ~18mm (18 / 25.4 * 72 = 51.02)
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN

// Colors
const COLOR_TEXT = rgb(0x1a / 255, 0x1d / 255, 0x23 / 255) // #1a1d23
const COLOR_MUTED = rgb(0x5b / 255, 0x64 / 255, 0x72 / 255) // #5b6472
const COLOR_RULE = rgb(0xe3 / 255, 0xe6 / 255, 0xeb / 255) // #e3e6eb
const COLOR_BRAND = rgb(0xc8 / 255, 0x10 / 255, 0x2e / 255) // #c8102e (PMI red)
const COLOR_GREEN = rgb(0x1b / 255, 0x7a / 255, 0x3e / 255) // #1b7a3e

// Archivo has no arrow glyph '→'. Draw arrow as SVG path.
function drawArrow(
  page: PDFPage,
  x: number,
  y: number,
  color = COLOR_MUTED,
) {
  page.drawSvgPath('M 0 0 L 12 0 M 9 -2.5 L 12 0 L 9 2.5', {
    x,
    y,
    borderColor: color,
    borderWidth: 1,
  })
}

function truncateText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
): string {
  if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) return text
  const ellipsis = '…'
  const ellWidth = font.widthOfTextAtSize(ellipsis, fontSize)
  let low = 0
  let high = text.length
  let best = ''
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const sub = text.slice(0, mid)
    if (font.widthOfTextAtSize(sub, fontSize) + ellWidth <= maxWidth) {
      best = sub
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return best + ellipsis
}

export async function generateRaporPdf(
  selected: Session[],
  row: RecapRow,
  assets: RaporAssets,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  const [regular, bold, display, logo] = await Promise.all([
    doc.embedFont(assets.fontRegular, { subset: true }),
    doc.embedFont(assets.fontBold, { subset: true }),
    doc.embedFont(assets.fontDisplay, { subset: true }),
    doc.embedPng(assets.logoPng),
  ])

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])

  const drawFooter = (p: PDFPage) => {
    const footerY = MARGIN + 18
    p.drawLine({
      start: { x: MARGIN, y: footerY },
      end: { x: PAGE_WIDTH - MARGIN, y: footerY },
      thickness: 1,
      color: COLOR_RULE,
    })

    const footerTextY = MARGIN + 4
    const leftText = 'KSR PMI Unit Universitas Telkom'
    const rightText = `Dicetak ${new Date().toLocaleDateString('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' })}`

    p.drawText(leftText, {
      x: MARGIN,
      y: footerTextY,
      size: 8,
      font: regular,
      color: COLOR_MUTED,
    })

    const rightWidth = regular.widthOfTextAtSize(rightText, 8)
    p.drawText(rightText, {
      x: PAGE_WIDTH - MARGIN - rightWidth,
      y: footerTextY,
      size: 8,
      font: regular,
      color: COLOR_MUTED,
    })
  }

  // --- HEADER ---
  let y = PAGE_HEIGHT - MARGIN

  // Right side header: "Rapor Peserta" + "Pre-test & post-test"
  const titleText = 'Rapor Peserta'
  const titleSize = 20
  const titleWidth = display.widthOfTextAtSize(titleText, titleSize)
  page.drawText(titleText, {
    x: PAGE_WIDTH - MARGIN - titleWidth,
    y: y - 18,
    size: titleSize,
    font: display,
    color: COLOR_TEXT,
  })

  const subtitleText = 'Pre-test & post-test'
  const subSize = 9
  const subWidth = regular.widthOfTextAtSize(subtitleText, subSize)
  page.drawText(subtitleText, {
    x: PAGE_WIDTH - MARGIN - subWidth,
    y: y - 32,
    size: subSize,
    font: regular,
    color: COLOR_MUTED,
  })

  // Left side header: Logo (raster 261x120 -> scaled to height 26, width ~56.55) + UjiKSR + KSR PMI Unit Universitas Telkom
  const logoH = 26
  const logoW = (logo.width / logo.height) * logoH
  page.drawImage(logo, {
    x: MARGIN,
    y: y - 28,
    width: logoW,
    height: logoH,
  })

  const brandX = MARGIN + logoW + 8
  page.drawText('UjiKSR', {
    x: brandX,
    y: y - 15,
    size: 13,
    font: display,
    color: COLOR_TEXT,
  })
  page.drawText('KSR PMI Unit Universitas Telkom', {
    x: brandX,
    y: y - 28,
    size: 8,
    font: regular,
    color: COLOR_MUTED,
  })

  // Red dividing bar
  y -= 44
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 3,
    color: COLOR_BRAND,
  })

  // --- IDENTITY SECTION ---
  y -= 26
  // Left: dl (Nama, NIM, Program studi)
  const dtX = MARGIN
  const ddX = MARGIN + 80

  // Nama
  page.drawText('Nama', { x: dtX, y, size: 9, font: regular, color: COLOR_MUTED })
  page.drawText(truncateText(row.name, bold, 9, 230), {
    x: ddX,
    y,
    size: 9,
    font: bold,
    color: COLOR_TEXT,
  })

  // NIM
  y -= 15
  page.drawText('NIM', { x: dtX, y, size: 9, font: regular, color: COLOR_MUTED })
  page.drawText(row.nim, { x: ddX, y, size: 9, font: regular, color: COLOR_TEXT })

  // Program studi
  y -= 15
  page.drawText('Program studi', { x: dtX, y, size: 9, font: regular, color: COLOR_MUTED })
  page.drawText(truncateText(row.prodi || '–', regular, 9, 230), {
    x: ddX,
    y,
    size: 9,
    font: regular,
    color: COLOR_TEXT,
  })

  // Right: Rata-rata nilai
  const avgLabel = 'Rata-rata nilai'
  const avgVal = row.average === null ? '–' : String(row.average)
  const attendedLabel = `${row.attended} dari ${selected.length} ujian diikuti`

  const avgValWidth = display.widthOfTextAtSize(avgVal, 28)
  const avgLblWidth = regular.widthOfTextAtSize(avgLabel, 8.5)
  const attWidth = regular.widthOfTextAtSize(attendedLabel, 8.5)

  const rightTopY = y + 26
  page.drawText(avgLabel, {
    x: PAGE_WIDTH - MARGIN - avgLblWidth,
    y: rightTopY,
    size: 8.5,
    font: regular,
    color: COLOR_MUTED,
  })
  page.drawText(avgVal, {
    x: PAGE_WIDTH - MARGIN - avgValWidth,
    y: rightTopY - 26,
    size: 28,
    font: display,
    color: COLOR_TEXT,
  })
  page.drawText(attendedLabel, {
    x: PAGE_WIDTH - MARGIN - attWidth,
    y: rightTopY - 39,
    size: 8.5,
    font: regular,
    color: COLOR_MUTED,
  })

  // --- TABLE SECTION ---
  y -= 30
  const colUjianX = MARGIN
  const colJenisX = MARGIN + 260
  const colTglX = MARGIN + 335
  const colNilaiRightX = PAGE_WIDTH - MARGIN
  const tableBottomMargin = MARGIN + 35

  const drawTableHeader = (p: PDFPage, currY: number) => {
    p.drawText('Ujian', { x: colUjianX, y: currY, size: 8.5, font: bold, color: COLOR_MUTED })
    p.drawText('Jenis', { x: colJenisX, y: currY, size: 8.5, font: bold, color: COLOR_MUTED })
    p.drawText('Tanggal', { x: colTglX, y: currY, size: 8.5, font: bold, color: COLOR_MUTED })
    const nw = bold.widthOfTextAtSize('Nilai', 8.5)
    p.drawText('Nilai', { x: colNilaiRightX - nw, y: currY, size: 8.5, font: bold, color: COLOR_MUTED })

    const lineY = currY - 6
    p.drawLine({
      start: { x: MARGIN, y: lineY },
      end: { x: PAGE_WIDTH - MARGIN, y: lineY },
      thickness: 1,
      color: COLOR_TEXT,
    })
    return lineY - 14
  }

  y = drawTableHeader(page, y)

  for (let i = 0; i < selected.length; i++) {
    if (y < tableBottomMargin + 20) {
      drawFooter(page)
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN - 10
      y = drawTableHeader(page, y)
    }

    const s = selected[i]
    const score = row.scores[i]

    const title = truncateText(s.title, regular, 9, 250)
    page.drawText(title, { x: colUjianX, y, size: 9, font: regular, color: COLOR_TEXT })

    const jenis = s.kind === 'pre' ? 'Pre-test' : 'Post-test'
    page.drawText(jenis, { x: colJenisX, y, size: 9, font: regular, color: COLOR_MUTED })

    page.drawText(formatDate(s.held_on), { x: colTglX, y, size: 9, font: regular, color: COLOR_MUTED })

    if (score !== null) {
      const scoreStr = String(score)
      const sw = bold.widthOfTextAtSize(scoreStr, 9)
      page.drawText(scoreStr, { x: colNilaiRightX - sw, y, size: 9, font: bold, color: COLOR_TEXT })
    } else {
      const absentStr = 'tidak ikut'
      const aw = regular.widthOfTextAtSize(absentStr, 9)
      page.drawText(absentStr, { x: colNilaiRightX - aw, y, size: 9, font: regular, color: COLOR_MUTED })
    }

    y -= 6
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: COLOR_RULE,
    })
    y -= 15
  }

  // --- PROGRESS SECTION (Pre-test -> Post-test pairs) ---
  const pairs = progressPairs(selected, row.scores)
  if (pairs.length > 0) {
    const boxRowH = 26
    const totalBoxH = 20 + pairs.length * boxRowH

    if (y - totalBoxH < tableBottomMargin) {
      drawFooter(page)
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      y = PAGE_HEIGHT - MARGIN - 20
    } else {
      y -= 10
    }

    const headingText1 = 'Perkembangan pre-test '
    const headingText2 = ' post-test'
    page.drawText(headingText1, {
      x: MARGIN,
      y,
      size: 8.5,
      font: bold,
      color: COLOR_MUTED,
    })
    const h1W = bold.widthOfTextAtSize(headingText1, 8.5)
    drawArrow(page, MARGIN + h1W + 1, y + 2.5, COLOR_MUTED)
    page.drawText(headingText2, {
      x: MARGIN + h1W + 16,
      y,
      size: 8.5,
      font: bold,
      color: COLOR_MUTED,
    })
    y -= 10

    const boxTopY = y
    const boxBottomY = y - pairs.length * boxRowH

    page.drawRectangle({
      x: MARGIN,
      y: boxBottomY,
      width: CONTENT_WIDTH,
      height: pairs.length * boxRowH,
      borderColor: COLOR_RULE,
      borderWidth: 1,
    })

    for (let pi = 0; pi < pairs.length; pi++) {
      const p = pairs[pi]
      const rowY = boxTopY - (pi + 1) * boxRowH + 8

      const rawTitle = selected[p.post].title.replace(/^\s*post[- ]?test\s*/i, '') || selected[p.post].title
      const topic = truncateText(rawTitle, regular, 9, 260)
      page.drawText(topic, {
        x: MARGIN + 12,
        y: rowY,
        size: 9,
        font: regular,
        color: COLOR_TEXT,
      })

      const preVal = row.scores[p.pre]
      const postVal = row.scores[p.post]
      const preStr = preVal === null ? '–' : String(preVal)
      const postStr = postVal === null ? '–' : String(postVal)
      const deltaStr = p.delta === null ? '–' : `${p.delta > 0 ? '+' : ''}${p.delta}`

      const deltaRightX = PAGE_WIDTH - MARGIN - 12
      const deltaFont = p.delta === null ? regular : bold
      const deltaColor = p.delta === null ? COLOR_MUTED : p.delta >= 0 ? COLOR_GREEN : COLOR_BRAND
      const dw = deltaFont.widthOfTextAtSize(deltaStr, 9)

      page.drawText(deltaStr, {
        x: deltaRightX - dw,
        y: rowY,
        size: 9,
        font: deltaFont,
        color: deltaColor,
      })

      const scoresRightX = deltaRightX - 45
      const postW = regular.widthOfTextAtSize(postStr, 9)
      page.drawText(postStr, {
        x: scoresRightX - postW,
        y: rowY,
        size: 9,
        font: regular,
        color: COLOR_MUTED,
      })

      const arrowX = scoresRightX - postW - 20
      drawArrow(page, arrowX, rowY + 3, COLOR_MUTED)
      const preW = regular.widthOfTextAtSize(preStr, 9)
      page.drawText(preStr, {
        x: arrowX - 8 - preW,
        y: rowY,
        size: 9,
        font: regular,
        color: COLOR_MUTED,
      })

      if (pi < pairs.length - 1) {
        const lineY = boxTopY - (pi + 1) * boxRowH
        page.drawLine({
          start: { x: MARGIN, y: lineY },
          end: { x: PAGE_WIDTH - MARGIN, y: lineY },
          thickness: 1,
          color: COLOR_RULE,
        })
      }
    }
  }

  drawFooter(page)

  return await doc.save()
}
