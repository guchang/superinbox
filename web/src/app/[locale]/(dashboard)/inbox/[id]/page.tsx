"use client"

import { useParams } from 'next/navigation'
import { InboxItemDetail } from '@/components/inbox/inbox-item-detail'

export default function InboxDetailPage() {
  const params = useParams()
  const id = params.id as string

  return <InboxItemDetail id={id} variant="page" />
}

