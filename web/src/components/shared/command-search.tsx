"use client"

import * as React from "react"
import { Search, Clock, X } from "lucide-react"
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { CategoryType, ItemStatus, type CategoryKey } from '@/types'
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// 搜索选项类型
type SearchOptionType = 'category' | 'status' | 'source' | 'hastype'
type HasType = 'text' | 'url' | 'image' | 'audio' | 'video' | 'file'

interface SearchOption {
  id: SearchOptionType
  label: string
  keywords: string[]
  prefix: string // 用于输入的前缀，如 "status:", "category:"
  values: Array<{ value: string; label: string }>
}

// 搜索解析结果
interface ParsedSearch {
  query: string // 全文搜索文本
  category?: CategoryKey
  status?: ItemStatus
  source?: string
  hasType?: HasType
}

interface CommandSearchProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  availableSources?: string[]
  availableCategories?: Array<{ key: string; name: string }>
  variant?: 'inline' | 'dialog'
  onConfirm?: () => void
}

export interface SearchFilters {
  query: string
  category?: CategoryKey
  status?: ItemStatus
  source?: string
  hasType?: HasType
}

const SEARCH_HISTORY_STORAGE_KEY = 'superinbox:command-search-history'
const MAX_SEARCH_HISTORY = 8

// 解析搜索字符串
function parseSearchString(input: string): ParsedSearch {
  const result: ParsedSearch = {
    query: ''
  }

  // 分割输入为多个部分
  const parts = input.trim().split(/\s+/)
  const queryParts: string[] = []

  for (const part of parts) {
    // 检查是否是 status:xxx
    const statusMatch = part.match(/^status:(\w+)$/i)
    if (statusMatch) {
      result.status = statusMatch[1] as ItemStatus
      continue
    }

    // 检查是否是 category:xxx
    const categoryMatch = part.match(/^category:(.+)$/i)
    if (categoryMatch) {
      const value = categoryMatch[1].trim()
      if (value) {
        result.category = value
      }
      continue
    }

    // 检查是否是 source:xxx
    const sourceMatch = part.match(/^source:(.+)$/i)
    if (sourceMatch) {
      result.source = sourceMatch[1]
      continue
    }

    // 检查是否是 hastype:xxx
    const hasTypeMatch = part.match(/^hastype:(.+)$/i)
    if (hasTypeMatch) {
      const value = hasTypeMatch[1].trim().toLowerCase() as HasType
      if (['text', 'url', 'image', 'audio', 'video', 'file'].includes(value)) {
        result.hasType = value
      }
      continue
    }

    // 否则是查询文本
    queryParts.push(part)
  }

  result.query = queryParts.join(' ')

  return result
}

export function CommandSearch({
  filters,
  onFiltersChange,
  availableSources = [],
  availableCategories = [],
  variant = 'inline',
  onConfirm,
}: CommandSearchProps) {
  const t = useTranslations('commandSearch')
  const isDialog = variant === 'dialog'
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [selectedIndex, setSelectedIndex] = React.useState(-1)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const dropdownScrollRef = React.useRef<HTMLDivElement>(null)
  const isJustOpened = React.useRef(false)

  const baseSearchOptions = React.useMemo<SearchOption[]>(() => ([
    {
      id: 'category',
      label: t('options.category.label'),
      keywords: ['category', '分类'],
      prefix: 'category:',
      values: [
        { value: CategoryType.TODO, label: t('categories.todo') },
        { value: CategoryType.IDEA, label: t('categories.idea') },
        { value: CategoryType.EXPENSE, label: t('categories.expense') },
        { value: CategoryType.NOTE, label: t('categories.note') },
        { value: CategoryType.BOOKMARK, label: t('categories.bookmark') },
        { value: CategoryType.SCHEDULE, label: t('categories.schedule') },
      ]
    },
    {
      id: 'status',
      label: t('options.status.label'),
      keywords: ['status', '状态'],
      prefix: 'status:',
      values: [
        { value: ItemStatus.PENDING, label: t('status.pending') },
        { value: ItemStatus.PROCESSING, label: t('status.processing') },
        { value: ItemStatus.COMPLETED, label: t('status.completed') },
        { value: ItemStatus.FAILED, label: t('status.failed') },
      ]
    },
    {
      id: 'source',
      label: t('options.source.label'),
      keywords: ['source', '来源'],
      prefix: 'source:',
      values: [] // 动态填充
    },
    {
      id: 'hastype',
      label: t('options.hastype.label'),
      keywords: ['hastype', 'type', '类型', '内容类型'],
      prefix: 'hastype:',
      values: [
        { value: 'text', label: t('contentTypes.text') },
        { value: 'url', label: t('contentTypes.url') },
        { value: 'image', label: t('contentTypes.image') },
        { value: 'audio', label: t('contentTypes.audio') },
        { value: 'video', label: t('contentTypes.video') },
        { value: 'file', label: t('contentTypes.file') },
      ]
    }
  ]), [t])

  const defaultSearchHistory = React.useMemo(() => ([
    'category:todo status:completed',
    t('history.meeting'),
    'status:failed',
  ]), [t])
  const [searchHistory, setSearchHistory] = React.useState<string[]>(defaultSearchHistory)

  React.useEffect(() => {
    try {
      const cachedHistory = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY)
      if (!cachedHistory) {
        setSearchHistory(defaultSearchHistory)
        return
      }

      const parsedHistory = JSON.parse(cachedHistory)
      if (!Array.isArray(parsedHistory)) {
        setSearchHistory(defaultSearchHistory)
        return
      }

      const cleanedHistory = parsedHistory
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim().replace(/\s+/g, ' '))
        .filter(Boolean)

      if (cleanedHistory.length > 0) {
        setSearchHistory(cleanedHistory.slice(0, MAX_SEARCH_HISTORY))
      } else {
        setSearchHistory(defaultSearchHistory)
      }
    } catch {
      setSearchHistory(defaultSearchHistory)
    }
  }, [defaultSearchHistory])

  const saveSearchHistory = React.useCallback((value: string) => {
    const normalizedValue = value.trim().replace(/\s+/g, ' ')
    if (!normalizedValue) return

    setSearchHistory((prevHistory) => {
      const nextHistory = [
        normalizedValue,
        ...prevHistory.filter(item => item !== normalizedValue),
      ].slice(0, MAX_SEARCH_HISTORY)

      try {
        window.localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory))
      } catch {
        return nextHistory
      }

      return nextHistory
    })
  }, [])

  const initialFiltersRef = React.useRef(filters)

  const getCategoryDisplayLabel = React.useCallback((categoryKey: string, fallbackLabel: string) => {
    switch (categoryKey) {
      case CategoryType.TODO:
        return t('categories.todo')
      case CategoryType.IDEA:
        return t('categories.idea')
      case CategoryType.EXPENSE:
        return t('categories.expense')
      case CategoryType.NOTE:
        return t('categories.note')
      case CategoryType.BOOKMARK:
        return t('categories.bookmark')
      case CategoryType.SCHEDULE:
        return t('categories.schedule')
      case 'unknown':
        return t('categories.unknown')
      default:
        return fallbackLabel
    }
  }, [t])

  React.useEffect(() => {
    if (!isDialog) return
    setOpen(true)
    setSelectedIndex(0)
  }, [isDialog])

  // 初始化输入值和选中索引
  React.useEffect(() => {
    const initialFilters = initialFiltersRef.current
    const parts: string[] = []
    if (initialFilters.category) parts.push(`category:${initialFilters.category}`)
    if (initialFilters.status) parts.push(`status:${initialFilters.status}`)
    if (initialFilters.source) parts.push(`source:${initialFilters.source}`)
    if (initialFilters.hasType) parts.push(`hastype:${initialFilters.hasType}`)
    if (initialFilters.query) parts.push(initialFilters.query)
    setInputValue(parts.join(' '))
    // 初始化选中索引为第一个选项
    setSelectedIndex(0)
  }, [])

  // 更新 source 选项
  const searchOptionsWithSources = React.useMemo(() => {
    return baseSearchOptions.map(option => {
      if (option.id === 'source') {
        return {
          ...option,
          values: availableSources.map(s => ({ value: s, label: s }))
        }
      }
      if (option.id === 'category') {
        return {
          ...option,
          values: availableCategories.length > 0
            ? availableCategories.map(category => ({
                value: category.key,
                label: getCategoryDisplayLabel(category.key, category.name),
              }))
            : option.values
        }
      }
      return option
    })
  }, [availableSources, availableCategories, baseSearchOptions, getCategoryDisplayLabel])

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "/" && !open) {
        e.preventDefault()
        const willOpen = !open
        setOpen(willOpen)
        if (willOpen) {
          // 打开时标记，并立即设置选中索引
          isJustOpened.current = true
          setSelectedIndex(0)
        }
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (e.key === "Escape" && open) {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [open])

  // 获取当前输入的建议
  const getSuggestions = React.useMemo(() => {
    if (!inputValue) {
      // 显示所有搜索选项
      const suggestions: Array<{ type: 'history' | 'option' | 'tip', text: string, description?: string }> = []

      // 使用提示（在最前）
      suggestions.push({
        type: 'tip',
        text: t('tip.text'),
        description: t('tip.description')
      })

      // 搜索选项
      searchOptionsWithSources.forEach(option => {
        suggestions.push({
          type: 'option',
          text: option.prefix,
          description: option.label
        })
      })

      // 搜索历史（在后）
      searchHistory.forEach(h => {
        suggestions.push({ type: 'history', text: h })
      })

      return suggestions
    }

    const suggestions: Array<{
      type: 'value' | 'option'
      text: string
      option?: SearchOption
      description?: string
      valueLabel?: string
    }> = []

    // 检查输入是否以空格结尾（表示用户想继续添加筛选）
    if (inputValue.endsWith(' ')) {
      // 解析当前已有的筛选类型
      const usedTypes = new Set<SearchOptionType>()
      const parts = inputValue.trim().split(/\s+/)
      for (const part of parts) {
        if (part.startsWith('category:')) usedTypes.add('category')
        if (part.startsWith('status:')) usedTypes.add('status')
        if (part.startsWith('source:')) usedTypes.add('source')
        if (part.startsWith('hastype:')) usedTypes.add('hastype')
      }

      // 只显示还没有使用的搜索选项
      searchOptionsWithSources.forEach(option => {
        if (!usedTypes.has(option.id)) {
          suggestions.push({
            type: 'option',
            text: option.prefix,
            description: option.label,
            option
          })
        }
      })
      return suggestions
    }

    // 检查最后一个部分是否是一个选项前缀
    const parts = inputValue.trim().split(/\s+/)
    const lastPart = parts[parts.length - 1]

    // 首先查找是否已经有匹配的选项（用户已输入前缀）
    const matchedOption = searchOptionsWithSources.find(option =>
      lastPart.toLowerCase().startsWith(option.prefix.toLowerCase()) ||
      option.keywords.some(k => lastPart.toLowerCase().startsWith(k.toLowerCase()))
    )

    if (matchedOption) {
      // 显示该选项的所有值（或过滤后的值）
      // 提取搜索词：去掉前缀部分
      let searchTerm = ''
      if (lastPart.toLowerCase().startsWith(matchedOption.prefix.toLowerCase())) {
        // 如果以前缀开头，去掉前缀部分
        searchTerm = lastPart.substring(matchedOption.prefix.length).toLowerCase()
      } else {
        // 如果以关键词开头，尝试从完整前缀中提取搜索词
        const prefixEndIndex = lastPart.indexOf(':')
        if (prefixEndIndex !== -1) {
          searchTerm = lastPart.substring(prefixEndIndex + 1).toLowerCase()
        }
      }

      matchedOption.values.forEach(value => {
        // 如果搜索词为空，显示所有值；否则过滤
        if (!searchTerm || value.label.toLowerCase().includes(searchTerm) || value.value.toLowerCase().includes(searchTerm)) {
          suggestions.push({
            type: 'value',
            text: `${matchedOption.prefix}${value.value}`,
            option: matchedOption,
            valueLabel: value.label,
          })
        }
      })

      return suggestions
    }

    // 如果没有匹配的选项，显示可能匹配的选项前缀
    // 当用户输入 "i" 时，显示 "category:" 选项
    // 解析当前已有的筛选类型
    const usedTypes = new Set<SearchOptionType>()
    const existingParts = inputValue.trim().split(/\s+/).slice(0, -1) // 排除最后一个正在输入的部分
    for (const part of existingParts) {
      if (part.startsWith('category:')) usedTypes.add('category')
      if (part.startsWith('status:')) usedTypes.add('status')
      if (part.startsWith('source:')) usedTypes.add('source')
      if (part.startsWith('hastype:')) usedTypes.add('hastype')
    }

    searchOptionsWithSources.forEach(option => {
      // 跳过已经使用的类型
      if (usedTypes.has(option.id)) return

      // 检查选项前缀或关键词是否以用户输入开头
      if (option.prefix.toLowerCase().startsWith(lastPart.toLowerCase()) ||
          option.keywords.some(k => k.toLowerCase().startsWith(lastPart.toLowerCase()))) {
        suggestions.push({
          type: 'option',
          text: option.prefix,
          description: option.label,
          option
        })
      }
    })

    // 如果没有匹配的结果，返回空数组
    return suggestions
  }, [inputValue, searchOptionsWithSources, searchHistory, t])

  // 应用搜索
  const applySearch = (value: string) => {
    const parsed = parseSearchString(value)
    onFiltersChange({
      query: parsed.query,
      category: parsed.category,
      status: parsed.status,
      source: parsed.source,
      hasType: parsed.hasType
    })
  }

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // 实时解析并应用筛选
    applySearch(newValue)

    // 重置选中索引为 0（默认选中第一个）
    setSelectedIndex(0)
  }

  // 处理键盘导航
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 确定当前有效的选中索引
    let currentIndex = selectedIndex
    if (isJustOpened.current || currentIndex < 0) {
      currentIndex = 0
      setSelectedIndex(0)
      isJustOpened.current = false
    }

    // 下方向键
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (currentIndex < suggestions.length - 1) {
        setSelectedIndex(currentIndex + 1)
      } else if (suggestions.length > 0) {
        setSelectedIndex(0)
      }
      return
    }

    // 上方向键
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (currentIndex > 0) {
        setSelectedIndex(currentIndex - 1)
      } else if (currentIndex === -1 && suggestions.length > 0) {
        setSelectedIndex(suggestions.length - 1)
      }
      return
    }

    // Tab 键 - 选择建议
    if (e.key === 'Tab') {
      e.preventDefault()

      // 使用当前有效的索引
      const effectiveIndex = currentIndex >= 0 && currentIndex < suggestions.length ? currentIndex : 0

      if (suggestions.length > 0) {
        const suggestion = suggestions[effectiveIndex]
        if (suggestion.type === 'history') {
          setInputValue(suggestion.text)
          applySearch(suggestion.text)
          saveSearchHistory(suggestion.text)
          setOpen(false)
        } else if (suggestion.type === 'option') {
          // 替换最后一个部分为选项前缀
          const parts = inputValue.trim().split(/\s+/)
          // 检查是否以空格结尾（表示要追加而不是替换）
          if (inputValue.endsWith(' ')) {
            // 追加选项前缀
            const newValue = inputValue + suggestion.text
            setInputValue(newValue)
            applySearch(newValue)
          } else {
            // 替换最后一个部分
            parts[parts.length - 1] = suggestion.text
            const newValue = parts.join(' ')
            setInputValue(newValue)
            applySearch(newValue)
          }
          // 保持打开状态，让用户继续输入值，默认选中第一个值
          setSelectedIndex(0)
          setTimeout(() => inputRef.current?.focus(), 0)
        } else if (suggestion.type === 'value') {
          // 替换最后一个部分
          const parts = inputValue.trim().split(/\s+/)
          parts[parts.length - 1] = suggestion.text
          const newValue = parts.join(' ') + ' '
          setInputValue(newValue)
          applySearch(newValue)
          // 保持打开状态，让用户继续添加其他筛选，默认选中第一个搜索选项
          setSelectedIndex(0)
          setTimeout(() => inputRef.current?.focus(), 0)
        }
      }

      return
    }

    // Escape 键关闭下拉框
    if (e.key === 'Escape' && open) {
      setOpen(false)
      return
    }

    if (e.key === 'Enter') {
      applySearch(inputValue)
      saveSearchHistory(inputValue)
      onConfirm?.()
    }
  }

  // 插入建议
  const insertSuggestion = (suggestion: typeof getSuggestions[0]) => {
    if (suggestion.type === 'history') {
      setInputValue(suggestion.text)
      applySearch(suggestion.text)
      saveSearchHistory(suggestion.text)
    } else if (suggestion.type === 'option') {
      // 替换最后一个部分为选项前缀
      const parts = inputValue.trim().split(/\s+/)
      // 检查是否以空格结尾（表示要追加而不是替换）
      if (inputValue.endsWith(' ')) {
        // 追加选项前缀
        const newValue = inputValue + suggestion.text
        setInputValue(newValue)
        applySearch(newValue)
      } else {
        // 替换最后一个部分
        parts[parts.length - 1] = suggestion.text
        const newValue = parts.join(' ')
        setInputValue(newValue)
        applySearch(newValue)
      }
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
      return
    } else if (suggestion.type === 'value') {
      const parts = inputValue.trim().split(/\s+/)
      parts[parts.length - 1] = suggestion.text
      const newValue = parts.join(' ') + ' '
      setInputValue(newValue)
      applySearch(newValue)
      // 保持打开状态，让用户继续添加其他筛选，默认选中第一个搜索选项
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
      return
    }
    inputRef.current?.focus()
  }

  // 清除所有
  const clearAll = () => {
    setInputValue('')
    onFiltersChange({ query: '' })
  }

  // 计算是否应该显示下拉框
  const suggestions = getSuggestions
  const shouldShowDropdown = open && suggestions.length > 0

  React.useEffect(() => {
    if (!shouldShowDropdown) return
    if (selectedIndex < 0 || selectedIndex >= suggestions.length) return

    const container = dropdownScrollRef.current
    if (!container) return

    const selectedItem = container.querySelector<HTMLElement>(`[data-suggestion-index="${selectedIndex}"]`)
    selectedItem?.scrollIntoView({ block: 'nearest' })
  }, [shouldShowDropdown, selectedIndex, suggestions.length, inputValue])

  const dialogItemClass = "rounded-none px-6 py-1.5 md:py-2 text-[13px] font-medium text-slate-700 dark:text-white/80"
  const dialogActiveClass = "bg-black/5 text-slate-900 dark:bg-white/10 dark:text-white"
  const dialogHintClass = "text-xs font-normal text-slate-500 dark:text-white/40"

  const dropdownContent = (
    <div ref={dropdownScrollRef} className={cn("max-h-[420px] overflow-auto", isDialog && "max-h-[520px]")}>
      <Command
        className={cn(
          "bg-transparent text-foreground",
          isDialog &&
            "bg-transparent text-slate-700 dark:text-white/80 [&_[cmdk-group]]:p-0 [&_[cmdk-group-heading]]:px-6 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-normal [&_[cmdk-group-heading]]:text-slate-500 dark:[&_[cmdk-group-heading]]:text-white/40 [&_[cmdk-item]]:px-6 [&_[cmdk-item]]:py-1.5 md:[&_[cmdk-item]]:py-2 [&_[cmdk-item]]:rounded-none"
        )}
      >
        <CommandList>
          {!inputValue && getSuggestions.filter(s => s.type === 'tip').map((suggestion, index) => (
            <div
              key={index}
              data-suggestion-index={index}
              className={cn(
                "h-10 flex items-center px-2 text-sm text-muted-foreground opacity-70",
                isDialog && "h-11 px-6"
              )}
            >
              <span className={cn(isDialog && dialogHintClass)}>{suggestion.text}</span>
            </div>
          ))}

          {!inputValue && (
            <CommandGroup heading={`${t('sections.options')} · ${t('tabHint')}`}>
              {searchOptionsWithSources.map((option, index) => (
                <CommandItem
                  key={option.id}
                  data-suggestion-index={index + 1}
                  onSelect={() => {
                    const parts = inputValue.trim().split(/\s+/)
                    parts[parts.length - 1] = option.prefix
                    const newValue = parts.join(' ')
                    setInputValue(newValue)
                    applySearch(newValue)
                    inputRef.current?.focus()
                  }}
                  className={cn(
                    "cursor-pointer",
                    isDialog && dialogItemClass,
                    selectedIndex === index + 1 && (isDialog ? dialogActiveClass : "bg-accent text-accent-foreground")
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm", isDialog && "text-[13px]")}>{option.label}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", isDialog && "border-black/10 bg-black/5 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60")}
                      >
                        {option.prefix}
                      </Badge>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!inputValue && searchHistory.length > 0 && (
            <CommandGroup heading={t('sections.history')}>
              {searchHistory.map((item, index) => (
                <CommandItem
                  key={index}
                  data-suggestion-index={searchOptionsWithSources.length + 1 + index}
                  onSelect={() => {
                    setInputValue(item)
                    applySearch(item)
                    saveSearchHistory(item)
                    setOpen(false)
                  }}
                  className={cn(
                    "cursor-pointer",
                    isDialog && dialogItemClass,
                    selectedIndex === searchOptionsWithSources.length + 1 + index &&
                      (isDialog ? dialogActiveClass : "bg-accent text-accent-foreground")
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Clock className={cn("h-3 w-3 opacity-50", isDialog && "h-4 w-4 opacity-60")} />
                      <span className={cn("text-sm", isDialog && "text-[13px]")}>{item}</span>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {inputValue && getSuggestions.length > 0 && (
            <CommandGroup heading={`${t('sections.suggestions')} · ${t('tabHint')}`}>
              {getSuggestions.map((suggestion, index) => (
                <CommandItem
                  key={index}
                  data-suggestion-index={index}
                  onSelect={() => {
                    insertSuggestion(suggestion)
                  }}
                  className={cn(
                    "cursor-pointer",
                    isDialog && dialogItemClass,
                    selectedIndex === index && (isDialog ? dialogActiveClass : "bg-accent text-accent-foreground")
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      {suggestion.type === 'history' && (
                        <>
                          <Clock className={cn("h-3 w-3 opacity-50", isDialog && "h-4 w-4 opacity-60")} />
                          <span className={cn("text-sm", isDialog && "text-[13px]")}>{suggestion.text}</span>
                        </>
                      )}
                      {suggestion.type === 'option' && (
                        <>
                          <span className={cn("text-sm", isDialog && "text-[13px]")}>{suggestion.description}</span>
                          <Badge
                            variant="outline"
                            className={cn("text-xs", isDialog && "border-black/10 bg-black/5 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60")}
                          >
                            {suggestion.text}
                          </Badge>
                        </>
                      )}
                      {suggestion.type === 'value' && suggestion.option && (
                        <>
                          <Badge
                            variant="outline"
                            className={cn("text-xs", isDialog && "border-black/10 bg-black/5 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/60")}
                          >
                            {suggestion.option.label}
                          </Badge>
                          <span className={cn("text-sm", isDialog && "text-[13px]")}>
                            {suggestion.valueLabel ?? suggestion.text.replace(suggestion.option.prefix, '')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  )

  const inputContent = (
    <div
      className={cn(
        "flex items-center gap-2 cursor-text transition-all duration-200",
        isDialog
          ? "h-[56px] w-full px-6 py-3 gap-4 rounded-[28px] sm:rounded-[28px] bg-white dark:bg-[#12121a]"
          : "px-3 py-2 text-sm bg-background border border-input rounded-md hover:bg-accent h-[40px]",
        !isDialog && (open ? "ring-2 ring-ring ring-offset-2 w-full md:w-[500px]" : "w-full md:w-[280px]"),
        !isDialog && "ml-auto"
      )}
      onClick={() => {
        if (!open) {
          setOpen(true)
          isJustOpened.current = true
          setSelectedIndex(0)
        }
        setTimeout(() => inputRef.current?.focus(), 0)
      }}
    >
      {isDialog ? (
        <Search className="h-5 w-5 opacity-80" />
      ) : (
        <Search className="h-4 w-4 shrink-0 opacity-50 pointer-events-none" />
      )}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={t('placeholder')}
        className={cn(
          "flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground",
          isDialog && "text-base text-slate-900 placeholder:text-slate-500 dark:text-white dark:placeholder:text-white/40"
        )}
      />
      {!inputValue && (
        isDialog ? (
          <span className="hidden sm:flex text-[14px] font-normal text-muted-foreground/60">
            {t('hint')}
          </span>
        ) : (
          <kbd className="pointer-events-none shrink-0 h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100 shadow-sm hidden sm:flex">
            /
          </kbd>
        )
      )}
      {inputValue && (
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-6 w-6 p-0 shrink-0", isDialog && "h-8 w-8")}
          onClick={(e) => {
            e.stopPropagation()
            clearAll()
          }}
        >
          <X className={cn("h-3 w-3", isDialog && "h-4 w-4")} />
        </Button>
      )}
    </div>
  )

  if (isDialog) {
    return (
      <div className="flex flex-col">
        <div>{inputContent}</div>
        {shouldShowDropdown && <div className="-mt-2 pb-0">{dropdownContent}</div>}
      </div>
    )
  }

  return (
    <Popover open={shouldShowDropdown} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{inputContent}</PopoverTrigger>
      <PopoverContent
        className="p-0 border shadow-lg"
        align="end"
        style={{ width: open ? '500px' : '400px' }}
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
      >
        {dropdownContent}
      </PopoverContent>
    </Popover>
  )
}
