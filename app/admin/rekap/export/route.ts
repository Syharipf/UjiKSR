import Papa from 'papaparse'
import { isAdmin } from '@/lib/admin-auth'
import { generateXlsxBuffer } from '@/lib/excel'
import { loadRecap, sessionLabel } from '../data'

export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response('Unauthorized', { status: 401 })

  const url = new URL(req.url)
  const { selected, recap } = await loadRecap(url.searchParams.getAll('s'))
  if (!recap) return new Response('Pilih minimal satu sesi', { status: 400 })

  const fields = ['nama', 'nim', 'prodi', ...selected.map(sessionLabel), 'jumlah_sesi', 'rata_rata']
  const data = recap.rows.map((r) => [
    r.name,
    r.nim,
    r.prodi,
    ...r.scores.map((x) => x ?? ''),
    r.attended,
    r.average ?? '',
  ])

  const format = url.searchParams.get('format')?.toLowerCase()
  if (format === 'csv') {
    const csv = Papa.unparse({ fields, data }, { escapeFormulae: true })
    return new Response('\uFEFF' + csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="rekap-nilai.csv"',
      },
    })
  }

  const rows = data.map((d) => Object.fromEntries(fields.map((f, i) => [f, d[i]])))
  const buf = generateXlsxBuffer('Rekap Nilai', rows)
  return new Response(buf as BodyInit, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': 'attachment; filename="rekap-nilai.xlsx"',
    },
  })
}
