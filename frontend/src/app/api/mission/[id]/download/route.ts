/**
 * Proxies the real generated-app zip from the NEXUS backend
 * (GET /api/mission/{id}/download) back to the browser.
 *
 * A plain client-side link to the backend would hardcode its origin into a
 * component and need CORS configured on a server that otherwise only talks
 * to Server Actions. Routing the download through this app's own origin
 * keeps NEXUS_BACKEND_URL server-side-only, consistent with every other
 * backend call in this app.
 */
import { NextRequest, NextResponse } from 'next/server';

const NEXUS_BACKEND_URL = process.env.NEXUS_BACKEND_URL || 'http://localhost:8001';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let upstream: Response;
  try {
    upstream = await fetch(`${NEXUS_BACKEND_URL}/api/mission/${id}/download`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    console.error(`[mission-download] backend unreachable for ${id}:`, err);
    return NextResponse.json(
      { error: 'Could not reach the NEXUS backend to fetch this mission\'s files.' },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    // Real backend reasons only -- "mission not found" vs "no app files
    // generated" -- never a generic error standing in for the real one.
    const detail = await upstream.text().catch(() => '');
    return NextResponse.json(
      { error: detail || `Backend returned ${upstream.status}` },
      { status: upstream.status }
    );
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': upstream.headers.get('content-disposition') || `attachment; filename="${id}.zip"`,
    },
  });
}
