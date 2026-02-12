'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { DragHandle } from '@tiptap/extension-drag-handle-react'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { cn } from '@/lib/utils'
import { normalizeExternalUrl } from '@/lib/external-url'

type EditorMode = 'rich' | 'markdown'

interface MarkdownRichEditorProps {
  value: string
  mode: EditorMode
  placeholder?: string
  className?: string
  height?: string
  onChange: (value: string) => void
  onBlur?: () => void
}

const normalizeMarkdown = (value: string) => value.replace(/\r\n?/g, '\n')
const SLASH_TRIGGER_PATTERN = /(?:^|\s)\/([a-zA-Z0-9-]*)$/

const markdownToHtml = (markdown: string): string => {
  const normalized = normalizeMarkdown(markdown)
  return String(marked.parse(normalized, { gfm: true, breaks: true }))
}

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  bulletListMarker: '-',
  strongDelimiter: '**',
})
turndownService.use(gfm)

const htmlToMarkdown = (html: string) => normalizeMarkdown(turndownService.turndown(html)).trimEnd()

interface SlashCommand {
  key: string
  label: string
  aliases: string[]
  run: (editor: Editor) => void
}

interface SlashState {
  open: boolean
  query: string
  from: number
  to: number
  x: number
  y: number
}

const CLOSED_SLASH_STATE: SlashState = {
  open: false,
  query: '',
  from: 0,
  to: 0,
  x: 0,
  y: 0,
}

export function MarkdownRichEditor({
  value,
  mode,
  placeholder,
  className,
  height = '420px',
  onChange,
  onBlur,
}: MarkdownRichEditorProps) {
  const shellRef = useRef<HTMLDivElement | null>(null)
  const isApplyingExternalRef = useRef(false)
  const lastSyncedMarkdownRef = useRef(normalizeMarkdown(value).trimEnd())
  const [slashState, setSlashState] = useState<SlashState>(CLOSED_SLASH_STATE)
  const [slashActiveIndex, setSlashActiveIndex] = useState(0)

  const closeSlashMenu = useCallback(() => {
    setSlashState((prev) => (prev.open ? CLOSED_SLASH_STATE : prev))
  }, [])

  const slashCommands = useMemo<SlashCommand[]>(() => ([
    {
      key: 'text',
      label: '正文',
      aliases: ['paragraph', 'text', 'p'],
      run: (nextEditor) => {
        nextEditor.chain().focus().setParagraph().run()
      },
    },
    {
      key: 'h1',
      label: '标题 1',
      aliases: ['h1', 'title', 'heading1'],
      run: (nextEditor) => {
        nextEditor.chain().focus().toggleHeading({ level: 1 }).run()
      },
    },
    {
      key: 'h2',
      label: '标题 2',
      aliases: ['h2', 'heading2'],
      run: (nextEditor) => {
        nextEditor.chain().focus().toggleHeading({ level: 2 }).run()
      },
    },
    {
      key: 'bullet',
      label: '无序列表',
      aliases: ['list', 'bullet', 'ul'],
      run: (nextEditor) => {
        nextEditor.chain().focus().toggleBulletList().run()
      },
    },
    {
      key: 'ordered',
      label: '有序列表',
      aliases: ['ordered', 'numbered', 'ol'],
      run: (nextEditor) => {
        nextEditor.chain().focus().toggleOrderedList().run()
      },
    },
    {
      key: 'task',
      label: '任务列表',
      aliases: ['task', 'todo', 'checkbox'],
      run: (nextEditor) => {
        nextEditor.chain().focus().toggleTaskList().run()
      },
    },
    {
      key: 'quote',
      label: '引用',
      aliases: ['quote', 'blockquote'],
      run: (nextEditor) => {
        nextEditor.chain().focus().toggleBlockquote().run()
      },
    },
    {
      key: 'code',
      label: '代码块',
      aliases: ['code', 'codeblock'],
      run: (nextEditor) => {
        nextEditor.chain().focus().toggleCodeBlock().run()
      },
    },
  ]), [])

  const filteredSlashCommands = useMemo(() => {
    const normalizedQuery = slashState.query.trim().toLowerCase()
    if (!normalizedQuery) return slashCommands

    return slashCommands.filter((command) => (
      command.label.toLowerCase().includes(normalizedQuery)
      || command.aliases.some((alias) => alias.includes(normalizedQuery))
    ))
  }, [slashCommands, slashState.query])

  useEffect(() => {
    setSlashActiveIndex((prev) => {
      if (filteredSlashCommands.length === 0) return 0
      return Math.min(prev, filteredSlashCommands.length - 1)
    })
  }, [filteredSlashCommands.length])

  const updateSlashState = useCallback((nextEditor: Editor) => {
    if (mode !== 'rich' || !nextEditor.isFocused) {
      closeSlashMenu()
      return
    }

    const { state, view } = nextEditor
    const { selection } = state

    if (!selection.empty) {
      closeSlashMenu()
      return
    }

    const { $from, from } = selection
    if (!$from.parent.isTextblock) {
      closeSlashMenu()
      return
    }

    const textBefore = $from.parent.textBetween(0, $from.parentOffset, '\0', '\0')
    const matched = textBefore.match(SLASH_TRIGGER_PATTERN)

    if (!matched || matched.index === undefined) {
      closeSlashMenu()
      return
    }

    const slashIndex = textBefore.lastIndexOf('/', textBefore.length)
    if (slashIndex < 0) {
      closeSlashMenu()
      return
    }

    const query = matched[1] || ''
    const fromPos = from - (textBefore.length - slashIndex)
    const toPos = from
    const caret = view.coordsAtPos(from)
    const shellRect = shellRef.current?.getBoundingClientRect()

    if (!shellRect) {
      closeSlashMenu()
      return
    }

    const x = Math.max(0, caret.left - shellRect.left)
    const y = Math.max(0, caret.bottom - shellRect.top + 6)

    setSlashState((prev) => {
      const nextState: SlashState = {
        open: true,
        query,
        from: fromPos,
        to: toPos,
        x,
        y,
      }

      if (
        prev.open === nextState.open
        && prev.query === nextState.query
        && prev.from === nextState.from
        && prev.to === nextState.to
        && prev.x === nextState.x
        && prev.y === nextState.y
      ) {
        return prev
      }

      return nextState
    })
  }, [closeSlashMenu, mode])

  const editorExtensions = useMemo(() => ([
    StarterKit,
    Link.configure({
      autolink: true,
      linkOnPaste: true,
      openOnClick: false,
      HTMLAttributes: {
        rel: 'noopener noreferrer',
        target: '_blank',
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({
      placeholder: placeholder || '',
    }),
  ]), [placeholder])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions,
    content: markdownToHtml(value),
    editorProps: {
      attributes: {
        class: 'tiptap-content',
      },
    },
    onUpdate: ({ editor: nextEditor }) => {
      if (isApplyingExternalRef.current) return

      const nextMarkdown = htmlToMarkdown(nextEditor.getHTML())
      if (nextMarkdown === lastSyncedMarkdownRef.current) return

      lastSyncedMarkdownRef.current = nextMarkdown
      onChange(nextMarkdown)
      updateSlashState(nextEditor)
    },
    onSelectionUpdate: ({ editor: nextEditor }) => {
      updateSlashState(nextEditor)
    },
    onBlur: () => {
      onBlur?.()
      closeSlashMenu()
    },
  })

  const applySlashCommand = useCallback((command: SlashCommand) => {
    if (!editor) return

    const commandRange = { from: slashState.from, to: slashState.to }
    editor.chain().focus().deleteRange(commandRange).run()
    command.run(editor)
    closeSlashMenu()
  }, [closeSlashMenu, editor, slashState.from, slashState.to])

  useEffect(() => {
    if (!editor) return

    const handleKeydown = (event: KeyboardEvent) => {
      if (!slashState.open || filteredSlashCommands.length === 0) return

      if (event.key === 'Escape') {
        event.preventDefault()
        closeSlashMenu()
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSlashActiveIndex((prev) => (
          filteredSlashCommands.length === 0 ? 0 : (prev + 1) % filteredSlashCommands.length
        ))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSlashActiveIndex((prev) => (
          filteredSlashCommands.length === 0
            ? 0
            : (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length
        ))
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const command = filteredSlashCommands[slashActiveIndex] || filteredSlashCommands[0]
        if (command) {
          applySlashCommand(command)
        }
      }
    }

    const element = editor.view.dom
    element.addEventListener('keydown', handleKeydown)

    return () => {
      element.removeEventListener('keydown', handleKeydown)
    }
  }, [
    applySlashCommand,
    closeSlashMenu,
    editor,
    filteredSlashCommands,
    slashActiveIndex,
    slashState.open,
  ])

  useEffect(() => {
    const normalized = normalizeMarkdown(value).trimEnd()
    lastSyncedMarkdownRef.current = normalized

    if (!editor || mode !== 'rich') return

    const currentMarkdown = htmlToMarkdown(editor.getHTML())
    if (currentMarkdown === normalized) return

    isApplyingExternalRef.current = true
    editor.commands.setContent(markdownToHtml(normalized), false, { preserveWhitespace: 'full' })
    isApplyingExternalRef.current = false
  }, [editor, mode, value])

  useEffect(() => {
    if (mode !== 'rich') {
      closeSlashMenu()
    }
  }, [closeSlashMenu, mode])

  const handleSetLink = useCallback(() => {
    if (!editor) return

    const currentHref = editor.getAttributes('link').href as string | undefined
    const inputValue = window.prompt('输入链接地址', currentHref || '')
    if (inputValue === null) return

    const normalized = normalizeExternalUrl(inputValue)

    if (!inputValue.trim()) {
      editor.chain().focus().unsetLink().run()
      return
    }

    if (!normalized) {
      window.alert('无效链接')
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run()
  }, [editor])

  if (mode === 'markdown') {
    return (
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={cn(
          'min-h-[420px] w-full resize-y rounded-lg border border-border/60 bg-background/70 px-4 py-3 font-mono text-sm leading-relaxed outline-none',
          'focus-visible:ring-2 focus-visible:ring-ring/40',
          className
        )}
      />
    )
  }

  return (
    <div
      ref={shellRef}
      className={cn(
        'relative rounded-lg border border-border/60 bg-background/70 px-4 py-3',
        className
      )}
      style={{ minHeight: height }}
    >
      {editor && (
        <BubbleMenu
          editor={editor}
          options={{ placement: 'top' }}
          className="tiptap-toolbar"
        >
          <button
            type="button"
            className={cn('tiptap-toolbar-btn', editor.isActive('bold') && 'is-active')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </button>
          <button
            type="button"
            className={cn('tiptap-toolbar-btn italic', editor.isActive('italic') && 'is-active')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </button>
          <button
            type="button"
            className={cn('tiptap-toolbar-btn', editor.isActive('code') && 'is-active')}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            {'</>'}
          </button>
          <button
            type="button"
            className={cn('tiptap-toolbar-btn', editor.isActive('link') && 'is-active')}
            onClick={handleSetLink}
          >
            Link
          </button>
        </BubbleMenu>
      )}

      {editor && (
        <FloatingMenu
          editor={editor}
          options={{ placement: 'left-start' }}
          shouldShow={({ state: nextState }) => {
            const { selection } = nextState
            if (!selection.empty) return false

            const { $from } = selection
            return $from.parent.type.name === 'paragraph' && $from.parent.textContent.length === 0
          }}
          className="tiptap-toolbar"
        >
          <button type="button" className="tiptap-toolbar-btn" onClick={() => editor.chain().focus().setParagraph().run()}>
            T
          </button>
          <button type="button" className="tiptap-toolbar-btn" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            H2
          </button>
          <button type="button" className="tiptap-toolbar-btn" onClick={() => editor.chain().focus().toggleBulletList().run()}>
            •
          </button>
          <button type="button" className="tiptap-toolbar-btn" onClick={() => editor.chain().focus().toggleTaskList().run()}>
            []
          </button>
          <button type="button" className="tiptap-toolbar-btn" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            {'</>'}
          </button>
        </FloatingMenu>
      )}

      {editor && (
        <DragHandle editor={editor} className="tiptap-drag-handle" nested>
          <button type="button" className="tiptap-drag-handle-btn" aria-label="Drag block">
            ⋮⋮
          </button>
        </DragHandle>
      )}

      <EditorContent editor={editor} />

      {slashState.open && filteredSlashCommands.length > 0 && (
        <div
          className="tiptap-slash-menu"
          style={{ top: slashState.y, left: slashState.x }}
        >
          {filteredSlashCommands.map((command, index) => (
            <button
              key={command.key}
              type="button"
              className={cn('tiptap-slash-item', slashActiveIndex === index && 'is-active')}
              onMouseEnter={() => setSlashActiveIndex(index)}
              onMouseDown={(event) => {
                event.preventDefault()
                applySlashCommand(command)
              }}
            >
              <span className="label">{command.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
