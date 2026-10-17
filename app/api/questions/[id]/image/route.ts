import { db, must } from '@/lib/db'

// Public like the question text it belongs to; the question id is only known to its participants and the committee.
export async function GET(_req: Request, ctx: RouteContext<'/api/questions/[id]/image'>) {
  const { id } = await ctx.params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Not found', { status: 404 })
  const img: { mime: string; data: string } | null = must(
    await db().from('question_images').select('mime, data').eq('question_id', id).maybeSingle(),
  )
  if (!img) return new Response('Not found', { status: 404 })
  return new Response(Buffer.from(img.data, 'base64'), {
    headers: {
      'content-type': img.mime,
      // The URL carries ?v=<rev>, so a replaced image gets a new URL.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
