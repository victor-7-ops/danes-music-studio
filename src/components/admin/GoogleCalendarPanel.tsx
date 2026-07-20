'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { connectGoogleCalendar } from '@/lib/actions/admin/connectGoogleCalendar'
import { disconnectGoogleCalendar } from '@/lib/actions/admin/disconnectGoogleCalendar'
import { syncGoogleCalendar } from '@/lib/actions/admin/syncGoogleCalendar'

interface GoogleCalendarPanelProps {
  initialGcalConnected: boolean
  initialGcalEmail: string | null
}

const labelClass = 'font-sans text-sm uppercase tracking-widest text-muted'

export default function GoogleCalendarPanel({
  initialGcalConnected,
  initialGcalEmail,
}: GoogleCalendarPanelProps) {
  const [gcalEmail, setGcalEmail] = useState<string | null>(initialGcalEmail)
  const [gcalConnected, setGcalConnected] = useState(initialGcalConnected)
  const [gcalLoading, setGcalLoading] = useState(false)
  const [gcalFeedback, setGcalFeedback] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  const searchParams = useSearchParams()

  useEffect(() => {
    // Read ?gcal= param from OAuth redirect
    const gcalParam = searchParams.get('gcal')
    if (gcalParam === 'connected') setGcalFeedback('Google Calendar connected successfully.')
    else if (gcalParam === 'error_no_refresh_token')
      setGcalFeedback(
        'Connection failed: Google did not return a refresh token. Try disconnecting and reconnecting.'
      )
    else if (gcalParam === 'error') setGcalFeedback('Connection failed. Please try again.')
  }, [searchParams])

  async function handleConnect() {
    setGcalLoading(true)
    await connectGoogleCalendar()
    // redirect() from the action navigates away — no need to reset loading
  }

  async function handleSync() {
    setGcalLoading(true)
    setSyncResult(null)
    const result = await syncGoogleCalendar()
    if (result.success) {
      setSyncResult(
        `Synced: ${result.inserted ?? 0} added, ${result.deleted ?? 0} removed, ${result.conflicts ?? 0} conflict(s) skipped.`
      )
    } else {
      setSyncResult(result.error ?? 'Sync failed.')
    }
    setGcalLoading(false)
  }

  async function handleDisconnect() {
    setGcalLoading(true)
    const result = await disconnectGoogleCalendar()
    if (result.success) {
      setGcalConnected(false)
      setGcalEmail(null)
      setGcalFeedback('Google Calendar disconnected.')
    } else {
      setGcalFeedback(result.error ?? 'Disconnect failed.')
    }
    setGcalLoading(false)
  }

  return (
    <div>
      <p className={`${labelClass} mb-3`}>Google Calendar</p>
      {gcalFeedback && (
        <p className="mb-3 font-sans text-sm text-ink border-l-2 border-ink/20 pl-3">{gcalFeedback}</p>
      )}
      {gcalConnected ? (
        <div className="space-y-3">
          <p className="font-sans text-sm text-ink">
            Connected as <span className="font-semibold">{gcalEmail}</span>
          </p>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={gcalLoading}
            className="bg-ink text-bg px-4 py-2 font-sans text-sm hover:opacity-80 transition-opacity uppercase tracking-widest disabled:opacity-50"
          >
            {gcalLoading ? 'Disconnecting...' : 'Disconnect'}
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={gcalLoading}
            className="bg-ink text-bg px-4 py-2 font-sans text-sm hover:opacity-80 transition-opacity uppercase tracking-widest disabled:opacity-50"
          >
            {gcalLoading ? 'Syncing...' : 'Sync Now'}
          </button>
          {syncResult && (
            <p className="font-sans text-xs text-muted">{syncResult}</p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={gcalLoading}
          className="bg-ink text-bg px-4 py-2 font-sans text-sm hover:opacity-80 transition-opacity uppercase tracking-widest disabled:opacity-50"
        >
          {gcalLoading ? 'Connecting...' : 'Connect Google Calendar'}
        </button>
      )}
    </div>
  )
}
