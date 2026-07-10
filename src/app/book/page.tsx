import DatePickerStep from '@/components/booking/DatePickerStep'
import ServiceSelectorStep from '@/components/booking/ServiceSelectorStep'

interface PageProps {
  searchParams: Promise<{ service?: string; rescheduled_from?: string }>
}

export default async function BookPage({ searchParams }: PageProps) {
  const { service, rescheduled_from } = await searchParams

  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16">
      {rescheduled_from && (
        <p className="font-sans text-sm text-muted border-l-2 border-ink/20 pl-3 mb-8 max-w-sm text-center">
          Booking {rescheduled_from} cancelled. Pick a new time below.
        </p>
      )}
      {service ? <DatePickerStep service={service} /> : <ServiceSelectorStep />}
    </main>
  )
}
