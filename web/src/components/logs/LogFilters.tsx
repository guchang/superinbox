'use client'

import { useState } from 'react'
import { QuickFilters } from './QuickFilters'
import { AdvancedFilters } from './AdvancedFilters'
import { FilterTags } from './FilterTags'
import type { LogFilters } from '@/types/logs'

interface LogFiltersProps {
  filters: LogFilters
  apiKeys?: Array<{ id: string; name: string; keyPreview: string }>
  onUpdate: (key: keyof LogFilters, value: any) => void
  onReset: () => void
}

export function LogFilters({ filters, apiKeys, onUpdate, onReset }: LogFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  const hasAdvancedFilters =
    (filters.methods && filters.methods.length > 0) ||
    !!filters.ipAddress ||
    !!filters.apiKeyId

  return (
    <div className="bg-card rounded-lg border">
      <QuickFilters
        filters={filters}
        hasAdvancedFilters={hasAdvancedFilters}
        onShowAdvanced={() => setShowAdvanced(!showAdvanced)}
        onUpdate={onUpdate}
      />

      {showAdvanced && (
        <AdvancedFilters
          filters={filters}
          apiKeys={apiKeys}
          onUpdate={onUpdate}
          onReset={onReset}
          onApply={() => setShowAdvanced(false)}
        />
      )}

      <FilterTags filters={filters} onRemove={(key) => onUpdate(key, undefined)} />
    </div>
  )
}
