import { redirect } from 'next/navigation'
import ReviewPage from '@/components/booking/ReviewPage'

interface PageProps {
  searchParams: Promise<{
    date?: string
    start?: string
    end?: string
    payment?: string
    name?: string
    email?: string
    phone?: string
    band?: string
  }>
}

export default async function ReviewServerPage({ searchParams }: PageProps) {
  const params = await searchParams
  const { date, start, end, payment, name, email, phone, band } = params

  if (!date || !start || !end || !payment || !name || !email || !phone) {
    redirect('/book')
  }

  if (payment !== 'full' && payment !== 'deposit') {
    redirect('/book')
  }

  const contactName = decodeURIComponent(name)
  const decodedEmail = decodeURIComponent(email)
  const decodedPhone = decodeURIComponent(phone)
  const bandName = band ? decodeURIComponent(band) : ''

  return (
    <div className="min-h-screen bg-bg px-6 py-16">
      <ReviewPage
        date={date}
        start={start}
        end={end}
        payment={payment as 'full' | 'deposit'}
        contactName={contactName}
        email={decodedEmail}
        phone={decodedPhone}
        bandName={bandName}
      />
    </div>
  )
}
