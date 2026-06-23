import { redirect } from 'next/navigation'
import DetailsForm from '@/components/booking/DetailsForm'

interface PageProps {
  searchParams: Promise<{ date?: string; start?: string; end?: string; payment?: string }>
}

export default async function DetailsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { date, start, end, payment } = params

  if (!date || !start || !end || !payment) {
    redirect('/book')
  }

  if (payment !== 'full' && payment !== 'deposit') {
    redirect('/book')
  }

  return (
    <div className="min-h-screen bg-bg px-6 py-16">
      <DetailsForm
        date={date}
        start={start}
        end={end}
        payment={payment as 'full' | 'deposit'}
      />
    </div>
  )
}
