// src/lib/paymongo.ts
// Single PayMongo integration point (D-03). All API communication funnelled here.
// Server-only: never import this file from a client component.

const PAYMONGO_BASE = 'https://api.paymongo.com/v1'

export async function createCheckoutSession(params: {
  amount: number          // centavos — integer, CLAUDE.md invariant 3
  description: string
  referenceNumber: string // DMS-XXXX confirmation code
  successUrl: string
  cancelUrl: string
}): Promise<string | null> {
  // D-02: read key at call time (not module level); return null if absent
  const secretKey = process.env.PAYMONGO_SECRET_KEY
  if (!secretKey) return null

  const body = {
    data: {
      attributes: {
        line_items: [
          {
            name: params.description,
            amount: params.amount, // centavos (integer)
            currency: 'PHP',
            quantity: 1,
          },
        ],
        payment_method_types: ['gcash', 'card'],
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        reference_number: params.referenceNumber,
        description: params.description,
      },
    },
  }

  const res = await fetch(`${PAYMONGO_BASE}/checkout_sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) return null

  const json = await res.json() as { data: { attributes: { checkout_url: string } } }
  return json.data.attributes.checkout_url
}
