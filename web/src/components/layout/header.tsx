"use client"

import * as React from "react"
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { INBOX_OPEN_SEARCH_EVENT } from '@/lib/constants/ui-events'

export function Header() {
  const handleSearchClick = () => {
    window.dispatchEvent(new Event(INBOX_OPEN_SEARCH_EVENT))
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleSearchClick}
      className="h-9 w-9"
    >
      <Search className="h-4 w-4" />
    </Button>
  )
}
