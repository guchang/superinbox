'use client'

import { Fragment } from 'react'
import { cn } from '@/lib/utils'
import { normalizeExternalUrl, shouldOpenInNewTab } from '@/lib/external-url'

const LINK_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+|mailto:[^\s<]+|tel:\+?[0-9][0-9().\-\s]{5,}[0-9]|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d{2,5})?(?:[/?#][^\s<]*)?)/gi

interface LinkifiedTextProps {
  text: string
  linkClassName?: string
}

function splitTrailingPunctuation(rawUrl: string) {
  let url = rawUrl
  let trailing = ''

  while (url.length > 0 && /[.,!?;:]/.test(url[url.length - 1])) {
    trailing = `${url[url.length - 1]}${trailing}`
    url = url.slice(0, -1)
  }

  let openParentheses = 0
  let closeParentheses = 0

  for (const char of url) {
    if (char === '(') openParentheses += 1
    if (char === ')') closeParentheses += 1
  }

  while (url.endsWith(')') && closeParentheses > openParentheses) {
    url = url.slice(0, -1)
    trailing = `)${trailing}`
    closeParentheses -= 1
  }

  return { url, trailing }
}

export function LinkifiedText({ text, linkClassName }: LinkifiedTextProps) {
  if (!text) return null

  const parts = text.split(LINK_PATTERN)

  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          const { url, trailing } = splitTrailingPunctuation(part)
          const normalizedUrl = normalizeExternalUrl(url)

          if (url && normalizedUrl) {
            const openInNewTab = shouldOpenInNewTab(normalizedUrl)
            return (
              <Fragment key={`${url}-${index}`}>
                <a
                  href={normalizedUrl}
                  target={openInNewTab ? '_blank' : undefined}
                  rel={openInNewTab ? 'noopener noreferrer' : undefined}
                  onClick={(event) => event.stopPropagation()}
                  className={cn('cursor-pointer underline underline-offset-2 decoration-dotted', linkClassName)}
                >
                  {url}
                </a>
                {trailing}
              </Fragment>
            )
          }
        }

        return <Fragment key={`${part}-${index}`}>{part}</Fragment>
      })}
    </>
  )
}
