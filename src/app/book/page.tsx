import DatePickerStep from '@/components/booking/DatePickerStep'
import ServiceSelectorStep from '@/components/booking/ServiceSelectorStep'

interface PageProps {
  searchParams: Promise<{ service?: string }>
}

export default async function BookPage({ searchParams }: PageProps) {
  const { service } = await searchParams

  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-16">
      {service ? <DatePickerStep service={service} /> : <ServiceSelectorStep />}
    </main>
  )
}
