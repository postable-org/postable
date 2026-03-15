import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Force dynamic so Next.js never tries to statically pre-render this SSE route
export const dynamic = 'force-dynamic'

const GO_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let upstream: Response
  try {
    upstream = await fetch(`${GO_API_URL}/api/generate`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } catch (err) {
    console.error('[generate] Go backend unreachable:', err)
    return NextResponse.json(
      { error: 'AI service unreachable — make sure the Go backend is running on port 8080' },
      { status: 503 }
    )
  }

  // If Go returned a non-200 (e.g. 404 brand not found), forward as JSON error
  if (!upstream.ok) {
    let body: unknown = {}
    try { body = await upstream.json() } catch { /* ignore */ }
    console.error('[generate] upstream error', upstream.status, body)
    return NextResponse.json(body, { status: upstream.status })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
