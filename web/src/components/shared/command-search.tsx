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
type SearchOptionType = 'category' | 'status' | 'source'

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
}

interface CommandSearchProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  availableSources?: string[]
  availableCategories?: Array<{ key: string; name: string }>
}

export interface SearchFilters {
  query: string
  category?: CategoryKey
  status?: ItemStatus
  source?: string
}

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
  availableCategories = []
}: CommandSearchProps) {
  const t = useTranslations('commandSearch')
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")
  const [selectedIndex, setSelectedIndex] = React.useState(-1)
  const inputRef = React.useRef<HTMLInputElement>(null)
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
    }
  ]), [t])

  const mockSearchHistory = React.useMemo(() => ([
    'category:todo status:completed',
    t('history.meeting'),
    'status:failed',
  ]), [t])

  // 初始化输入值和选中索引
  React.useEffect(() => {
    const parts: string[] = []
    if (filters.category) parts.push(`category:${filters.category}`)
    if (filters.status) parts.push(`status:${filters.status}`)
    if (filters.source) parts.push(`source:${filters.source}`)
    if (filters.query) parts.push(filters.query)
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
            ? availableCategories.map(category => ({ value: category.key, label: category.name }))
            : option.values
        }
      }
      return option
    })
  }, [availableSources, availableCategories, baseSearchOptions])

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
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
      const suggestions: Array<{ type: 'history' | 'option', text: string, description?: string }> = []

      // 搜索选项（在前）
      searchOptionsWithSources.forEach(option => {
        suggestions.push({
          type: 'option',
          text: option.prefix,
          description: option.label
        })
      })

      // 搜索历史（在后）
      mockSearchHistory.forEach(h => {
        suggestions.push({ type: 'history', text: h })
      })

      return suggestions
    }

    const suggestions: Array<{ type: 'value' | 'option', text: string, option?: SearchOption, description?: string }> = []

    // 检查输入是否以空格结尾（表示用户想继续添加筛选）
    if (inputValue.endsWith(' ')) {
      // 显示所有搜索选项
      searchOptionsWithSources.forEach(option => {
        suggestions.push({
          type: 'option',
          text: option.prefix,
          description: option.label,
          option
        })
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
            option: matchedOption
          })
        }
      })

      return suggestions
    }

    // 如果没有匹配的选项，显示可能匹配的选项前缀
    // 当用户输入 "i" 时，显示 "category:" 选项
    searchOptionsWithSources.forEach(option => {
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
  }, [inputValue, searchOptionsWithSources])

  // 应用搜索
  const applySearch = (value: string) => {
    const parsed = parseSearchString(value)
    onFiltersChange({
      query: parsed.query,
      category: parsed.category,
      status: parsed.status,
      source: parsed.source
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
  }

  // 插入建议
  const insertSuggestion = (suggestion: typeof getSuggestions[0]) => {
    if (suggestion.type === 'history') {
      setInputValue(suggestion.text)
      applySearch(suggestion.text)
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

  return (
    <Popover open={shouldShowDropdown} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 text-sm bg-background border border-input rounded-md cursor-text hover:bg-accent transition-all duration-200 h-[40px]",
            open ? "ring-2 ring-ring ring-offset-2 w-full md:w-[500px]" : "w-full md:w-[280px]",
            "ml-auto" // 右对齐
          )}
          onClick={() => {
            if (!open) {
              setOpen(true)
              // 打开时标记，并立即设置选中索引
              isJustOpened.current = true
              setSelectedIndex(0)
            }
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
        >
          <Search className="h-4 w-4 shrink-0 opacity-50 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder')}
            className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
          />
          {inputValue && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 shrink-0"
              onClick={(e) => {
                e.stopPropagation()
                clearAll()
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 border shadow-lg"
        align="end"
        style={{ width: open ? '500px' : '400px' }}
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
      >
        <div className="max-h-[400px] overflow-auto">
          <Command>
            <CommandList>
              {/* 搜索选项 */}
              {!inputValue && (
                <CommandGroup heading={t('sections.options')}>
                  {searchOptionsWithSources.map((option, index) => (
                    <CommandItem
                      key={option.id}
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
                        selectedIndex === index && "bg-accent text-accent-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{option.label}</span>
                          <Badge variant="outline" className="text-xs">{option.prefix}</Badge>
                        </div>
                        {selectedIndex === index && (
                          <span className="text-xs text-muted-foreground">{t('hint')}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* 搜索历史 */}
              {!inputValue && (
                <CommandGroup heading={t('sections.history')}>
                  {mockSearchHistory.map((item, index) => (
                    <CommandItem
                      key={index}
                      onSelect={() => {
                        setInputValue(item)
                        applySearch(item)
                        setOpen(false)
                      }}
                      className={cn(
                        "cursor-pointer",
                        selectedIndex === searchOptionsWithSources.length + index && "bg-accent text-accent-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 opacity-50" />
                          <span className="text-sm">{item}</span>
                        </div>
                        {selectedIndex === searchOptionsWithSources.length + index && (
                          <span className="text-xs text-muted-foreground">{t('hint')}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* 值建议 */}
              {inputValue && getSuggestions.length > 0 && (
                <CommandGroup heading={t('sections.suggestions')}>
                  {getSuggestions.map((suggestion, index) => (
                    <CommandItem
                      key={index}
                      onSelect={() => {
                        insertSuggestion(suggestion)
                      }}
                      className={cn(
                        "cursor-pointer",
                        selectedIndex === index && "bg-accent text-accent-foreground"
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          {suggestion.type === 'history' && (
                            <>
                              <Clock className="h-3 w-3 opacity-50" />
                              <span className="text-sm">{suggestion.text}</span>
                            </>
                          )}
                          {suggestion.type === 'option' && (
                            <>
                              <span className="text-sm">{suggestion.description}</span>
                              <Badge variant="outline" className="text-xs">{suggestion.text}</Badge>
                            </>
                          )}
                          {suggestion.type === 'value' && suggestion.option && (
                            <>
                              <Badge variant="outline" className="text-xs">{suggestion.option.label}</Badge>
                              <span className="text-sm">{suggestion.text.replace(suggestion.option.prefix, '')}</span>
                            </>
                          )}
                        </div>
                        {selectedIndex === index && (
                          <span className="text-xs text-muted-foreground">{t('hint')}</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </div>
      </PopoverContent>
    </Popover>
  )
}
