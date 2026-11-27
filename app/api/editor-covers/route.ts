import { NextResponse } from 'next/server'
import { importEditorCovers } from '@/lib/editorCovers'
import { withErrors } from '@/lib/apiError'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

// 本機後台「從剪輯台帶入封面」
async function handlePOST() {
  return NextResponse.json(await importEditorCovers())
}

export const POST = withErrors(handlePOST)
