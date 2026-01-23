"use client"

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import type { ApiKey } from '@/types/api-key'
import { SCOPE_GROUPS } from '@/types/api-key'
import { createApiKey, updateApiKey } from '@/lib/api/api-keys'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'

interface ApiKeyDialogProps {
  open: boolean
  onClose: (createdKey?: { keyValue: string; name?: string; scopes: string[] }) => void
  apiKey?: ApiKey
}

export function ApiKeyDialog({ open, onClose, apiKey }: ApiKeyDialogProps) {
  const t = useTranslations('apiKeys.dialog')
  const errors = useTranslations('errors')
  const [name, setName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const isEdit = Boolean(apiKey)

  // Initialize form data
  useEffect(() => {
    if (apiKey) {
      setName(apiKey.name || '')
      setSelectedScopes(apiKey.scopes)
    } else {
      setName('')
      setSelectedScopes(['inbox:read', 'inbox:write'])
    }
  }, [apiKey, open])

  // Handle scope toggle
  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    )
  }

  // Handle submit
  const handleSubmit = async () => {
    if (selectedScopes.length === 0) {
      toast({
        title: t('validation.emptyScopes.title'),
        description: t('validation.emptyScopes.description'),
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)

      if (isEdit && apiKey) {
        // Update existing key
        await updateApiKey(apiKey.id, {
          name: name || undefined,
          scopes: selectedScopes,
        })
        toast({
          title: t('toast.updateSuccess.title'),
          description: t('toast.updateSuccess.description'),
        })
        onClose()
      } else {
        // Create new key - immediately close and show in dedicated dialog
        const result = await createApiKey({
          name: name || undefined,
          scopes: selectedScopes,
        })

        // Return the created key data to parent
        // Note: backend returns 'apiKey' field, not 'keyValue'
        onClose({
          keyValue: (result as any).apiKey || '',
          name: name || undefined,
          scopes: selectedScopes,
        })
      }
    } catch (error) {
      toast({
        title: isEdit ? t('toast.updateFailure.title') : t('toast.createFailure.title'),
        description: getApiErrorMessage(error, errors, t('toast.failureDescription')),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle close
  const handleClose = () => {
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t('title.edit') : t('title.create')}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t('description.edit') : t('description.create')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">{t('fields.name.label')}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('fields.name.placeholder')}
            />
            <p className="text-xs text-muted-foreground">
              {t('fields.name.helper')}
            </p>
          </div>

          <div className="space-y-4">
            <Label>{t('fields.scopes.label')}</Label>
            {SCOPE_GROUPS.map((group) => (
              <div key={group.labelKey} className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {t(group.labelKey)}
                </h4>
                <div className="space-y-2 pl-2">
                  {group.scopes.map((scope) => (
                    <div
                      key={scope.value}
                      className="flex items-start space-x-3"
                    >
                      <Checkbox
                        id={scope.value}
                        checked={selectedScopes.includes(scope.value)}
                        onCheckedChange={() => toggleScope(scope.value)}
                      />
                      <div className="grid gap-1 leading-none">
                        <label
                          htmlFor={scope.value}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {t(scope.labelKey)}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {t(scope.descriptionKey)}
                        </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {t('actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? t('actions.loading') : isEdit ? t('actions.save') : t('actions.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
