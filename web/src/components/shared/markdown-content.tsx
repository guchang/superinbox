'use client'

import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { normalizeExternalUrl, shouldOpenInNewTab } from '@/lib/external-url'

interface MarkdownContentProps {
  text: string
  className?: string
  emptyText?: string
}

export function MarkdownContent({ text, className, emptyText }: MarkdownContentProps) {
  const normalized = text.trim()

  if (!normalized) {
    if (!emptyText) return null
    return <span className="text-muted-foreground italic">{emptyText}</span>
  }

  return (
    <div
      className={cn(
        'space-y-3 text-sm leading-relaxed break-words text-foreground',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-dotted',
        '[&_p]:my-0',
        '[&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:leading-tight',
        '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-tight',
        '[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:leading-tight',
        '[&_h4]:text-base [&_h4]:font-semibold [&_h4]:leading-tight',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1',
        '[&_li]:leading-relaxed',
        '[&_li.task-list-item]:list-none [&_li.task-list-item]:ml-0',
        '[&_li.task-list-item>label]:inline-flex',
        '[&_li.task-list-item>label]:items-start',
        '[&_li.task-list-item>label]:gap-2',
        '[&_li.task-list-item>label>input]:mt-1',
        '[&_li.task-list-item>label>input]:h-3.5 [&_li.task-list-item>label>input]:w-3.5',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]',
        '[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:px-3 [&_pre]:py-2',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_hr]:border-border [&_hr]:my-3',
        '[&_table]:w-full [&_table]:border-collapse [&_table]:text-left',
        '[&_thead]:border-b [&_thead]:border-border',
        '[&_th]:px-2 [&_th]:py-1.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground',
        '[&_td]:border-b [&_td]:border-border/80 [&_td]:px-2 [&_td]:py-1.5',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ href, children }) => {
            const normalizedHref = href ? normalizeExternalUrl(href) : null

            if (!normalizedHref) {
              return <span>{children}</span>
            }

            const openInNewTab = shouldOpenInNewTab(normalizedHref)

            return (
              <a
                href={normalizedHref}
                target={openInNewTab ? '_blank' : undefined}
                rel={openInNewTab ? 'noopener noreferrer' : undefined}
              >
                {children}
              </a>
            )
          },
          code: ({ className: nodeClassName, children, ...props }) => {
            const isBlock = typeof nodeClassName === 'string' && nodeClassName.includes('language-')

            if (isBlock) {
              return (
                <code className={nodeClassName} {...props}>
                  {children}
                </code>
              )
            }

            return (
              <code {...props}>
                {children}
              </code>
            )
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
