import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Force dynamic so Next.js never tries to statically pre-render this SSE route
export const dynamic = 'force-dynamic'

const GO_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
}

async function getSession() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown = {}
  try { body = await request.json() } catch { /* ignore */ }

  let upstream: Response
  try {
    upstream = await fetch(`${GO_API_URL}/api/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error('[generate] Go backend unreachable:', err)
    return NextResponse.json(
      { error: 'AI service unreachable — make sure the Go backend is running on port 8080' },
      { status: 503 }
    )
  }

  if (!upstream.ok) {
    let errBody: unknown = {}
    try { errBody = await upstream.json() } catch { /* ignore */ }
    console.error('[generate] upstream error', upstream.status, errBody)
    return NextResponse.json(errBody, { status: upstream.status })
  }

  return new Response(upstream.body, { status: 200, headers: SSE_HEADERS })
}

export async function GET(request: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let upstream: Response
  const platform = request.nextUrl.searchParams.get('platform') ?? 'instagram'

  try {
    upstream = await fetch(`${GO_API_URL}/api/generate?platform=${encodeURIComponent(platform)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } catch (err) {
    console.error('[generate] Go backend unreachable:', err)
    return NextResponse.json(
      { error: 'AI service unreachable — make sure the Go backend is running on port 8080' },
      { status: 503 }
    )
  }

  if (!upstream.ok) {
    let body: unknown = {}
    try { body = await upstream.json() } catch { /* ignore */ }
    console.error('[generate] upstream error', upstream.status, body)
    return NextResponse.json(body, { status: upstream.status })
  }

  return new Response(upstream.body, { status: 200, headers: SSE_HEADERS })
}
