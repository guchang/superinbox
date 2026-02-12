'use client'

import { useEffect, useRef } from 'react'
import { Extension, InputRule } from '@tiptap/core'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/react'
import { MARKDOWN_CONTENT_CLASSNAME } from '@/components/shared/markdown-content'
import { cn } from '@/lib/utils'

interface DetailMarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

const markdownTaskListInputRegex = /^\s*([-+*])\s+\[([ xX])\]\s$/

const MarkdownTaskListInput = Extension.create({
  name: 'markdownTaskListInput',
  addInputRules() {
    return [
      new InputRule({
        find: markdownTaskListInputRegex,
        handler: ({ chain, range, match }) => {
          const checked = (match[2] ?? '').toLowerCase() === 'x'

          chain()
            .deleteRange(range)
            .toggleTaskList()
            .updateAttributes('taskItem', { checked })
            .run()
        },
      }),
    ]
  },
})

function normalizeMarkdown(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const leadingTabs = line.match(/^\t+(?=\s*(?:[-+*]|\d+\.)\s)/)?.[0].length ?? 0
      if (leadingTabs === 0) return line
      return `${'  '.repeat(leadingTabs)}${line.slice(leadingTabs)}`
    })
    .join('\n')
}

export function DetailMarkdownEditor({
  value,
  onChange,
  placeholder,
  className,
  disabled = false,
}: DetailMarkdownEditorProps) {
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Markdown.configure({
        indentation: {
          style: 'space',
          size: 2,
        },
      }),
      MarkdownTaskListInput,
    ],
    content: normalizeMarkdown(value),
    contentType: 'markdown',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          MARKDOWN_CONTENT_CLASSNAME,
          'detail-markdown-editor-content'
        ),
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onChangeRef.current(normalizeMarkdown(currentEditor.getMarkdown()))
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!disabled)
  }, [editor, disabled])

  useEffect(() => {
    if (!editor) return

    const incoming = normalizeMarkdown(value)
    const current = normalizeMarkdown(editor.getMarkdown())

    if (incoming === current) return

    editor.commands.setContent(incoming, {
      contentType: 'markdown',
    })
  }, [editor, value])

  return (
    <div
      className={cn(
        'relative min-h-[220px] rounded-md border border-border bg-background/60 p-4 text-sm leading-relaxed',
        'focus-within:ring-2 focus-within:ring-ring/20',
        disabled && 'cursor-not-allowed opacity-70',
        className
      )}
    >
      {!value.trim() && placeholder ? (
        <span className="pointer-events-none absolute left-4 top-4 text-sm text-muted-foreground">
          {placeholder}
        </span>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  )
}
