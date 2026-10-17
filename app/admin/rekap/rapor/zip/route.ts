import { promises as fs } from 'node:fs'
import path from 'node:path'
import { isAdmin } from '@/lib/admin-auth'
import { generateRaporPdf, type RaporAssets } from '@/lib/rapor/pdf'
import { zipSync } from 'fflate'
import { loadRecap } from '../../data'

const sanitizeFilename = (name: string) => name.replace(/[/\\:*?"<>|]/g, '_').trim()

export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response('Unauthorized', { status: 401 })

  const url = new URL(req.url)
  const { selected, recap } = await loadRecap(url.searchParams.getAll('s'))
  if (!recap || selected.length === 0 || recap.rows.length === 0) {
    return new Response('Pilih minimal satu sesi dengan data peserta', { status: 400 })
  }

  const [logoPng, fontRegular, fontBold, fontDisplay] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'lib/rapor/logo.png')),
    fs.readFile(path.join(process.cwd(), 'lib/rapor/archivo-regular.ttf')),
    fs.readFile(path.join(process.cwd(), 'lib/rapor/archivo-bold.ttf')),
    fs.readFile(path.join(process.cwd(), 'lib/rapor/archivo-display.ttf')),
  ])

  const assets: RaporAssets = { logoPng, fontRegular, fontBold, fontDisplay }

  const files: Record<string, Uint8Array> = {}
  for (const row of recap.rows) {
    const pdfBytes = await generateRaporPdf(selected, row, assets)
    const filename = sanitizeFilename(`Rapor ${row.nim} ${row.name}`) + '.pdf'
    files[filename] = pdfBytes
  }

  const zipBytes = zipSync(files, { level: 0 })
  const dateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' })

  return new Response(zipBytes as BodyInit, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="rapor-${dateStr}.zip"`,
    },
  })
}
