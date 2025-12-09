import { NextRequest } from 'next/server'
import { progressTracker } from '@/lib/progress-tracker'
import type { ProgressUpdate } from '@/lib/progress-tracker'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const id = searchParams.get('id')

  if (!id) {
    return new Response('Missing id parameter', { status: 400 })
  }

  // Create a readable stream for Server-Sent Events
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const sendUpdate = (update: ProgressUpdate) => {
        const data = `data: ${JSON.stringify(update)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      // Subscribe to progress updates
      progressTracker.subscribe(id, sendUpdate)

      // Send initial connection message
      sendUpdate({
        id,
        step: 'connected',
        progress: 0,
        message: 'connected',
        timestamp: Date.now(),
      })

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        progressTracker.unsubscribe(id, sendUpdate)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
