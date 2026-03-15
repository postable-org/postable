import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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

  const formData = await request.formData()
  const file = formData.get('file') as Blob | null
  if (!file) {
    return NextResponse.json({ error: 'no file provided' }, { status: 400 })
  }

  const originalName = (file as File).name ?? 'upload'
  const ext = originalName.includes('.') ? originalName.split('.').pop() : 'bin'
  const randomHex = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)
  const path = `${session.user.id}/${randomHex}.${ext}`

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const arrayBuffer = await file.arrayBuffer()
  const { error } = await adminClient.storage
    .from('brand-assets')
    .upload(path, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (error) {
    console.error('[upload] storage error:', error)
    return NextResponse.json({ error: 'upload failed' }, { status: 500 })
  }

  const { data } = adminClient.storage.from('brand-assets').getPublicUrl(path)

  return NextResponse.json({ url: data.publicUrl })
}
