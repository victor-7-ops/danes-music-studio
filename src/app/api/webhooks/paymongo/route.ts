export const runtime = 'nodejs'

// PayMongo is intentionally not an active payment integration. Keep the URL
// explicit so a stale provider configuration cannot hit an insecure handler.
export async function POST(): Promise<Response> {
  return Response.json({ error: 'PayMongo payments are disabled.' }, { status: 410 })
}
