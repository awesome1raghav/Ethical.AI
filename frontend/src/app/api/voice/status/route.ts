/**
 * @fileOverview REST endpoint for Voice Engine health and status.
 */

import { NextResponse } from 'next/server';
import { VOICE_ENGINE_CONFIG } from '@/voice-engine/config';

export async function GET() {
  return NextResponse.json({
    status: 'HEALTHY',
    engine: 'Nexus Voice Processor v1.0',
    capabilities: ['REALTIME_STREAMING', 'MULTI_LANGUAGE'],
    config: VOICE_ENGINE_CONFIG,
    timestamp: Date.now()
  });
}
