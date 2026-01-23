"use client"

import { useState, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Plus, RefreshCw, Trash2, Edit } from 'lucide-react'
import type { ApiKey } from '@/types/api-key'
import { listApiKeys, deleteApiKey } from '@/lib/api/api-keys'
import { ApiKeyDialog } from '@/components/api-keys/api-key-dialog'
import { ShowApiKeyDialog } from '@/components/api-keys/show-api-key-dialog'
import { getApiErrorMessage } from '@/lib/i18n/api-errors'

export default function ApiKeysPage() {
  const t = useTranslations('apiKeys')
  const errors = useTranslations('errors')
  const locale = useLocale()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<ApiKey | undefined>()
  const [showKeyDialogOpen, setShowKeyDialogOpen] = useState(false)
  const [newApiKey, setNewApiKey] = useState<{ keyValue: string; name?: string; scopes: string[] } | null>(null)
  const { toast } = useToast()

  // Load API keys
  const loadApiKeys = async () => {
    try {
      setLoading(true)
      const keys = await listApiKeys()
      setApiKeys(keys)
    } catch (error) {
      console.error('Failed to load API keys:', error)
      toast({
        title: t('toast.loadFailure.title'),
        description: getApiErrorMessage(error, errors, t('toast.loadFailure.description')),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApiKeys()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle create/edit
  const handleCreateOrEdit = (key?: ApiKey) => {
    setSelectedKey(key)
    setDialogOpen(true)
  }

  // Handle dialog close
  const handleDialogClose = (createdKey?: { keyValue: string; name?: string; scopes: string[] }) => {
    setDialogOpen(false)
    setSelectedKey(undefined)
    if (createdKey) {
      // New key was created, show it in the special dialog
      setNewApiKey(createdKey)
      setShowKeyDialogOpen(true)
      loadApiKeys()
    }
  }

  // Handle delete
  const handleDelete = async (key: ApiKey) => {
    const keyName = key.name || key.id
    if (!confirm(t('confirmDelete', { name: keyName }))) {
      return
    }

    try {
      await deleteApiKey(key.id)
      toast({
        title: t('toast.deleteSuccess.title'),
        description: t('toast.deleteSuccess.description', { name: key.name || key.id }),
      })
      loadApiKeys()
    } catch (error) {
      toast({
        title: t('toast.deleteFailure.title'),
        description: getApiErrorMessage(error, errors, t('toast.deleteFailure.description')),
        variant: 'destructive',
      })
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
        </div>
        <Button onClick={() => handleCreateOrEdit()}>
          <Plus className="mr-2 h-4 w-4" />
          {t('actions.create')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>{t('empty.title')}</p>
          <p className="text-sm mt-2">{t('empty.description')}</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-sm">{t('table.name')}</th>
                <th className="text-left py-3 px-4 font-medium text-sm">{t('table.key')}</th>
                <th className="text-left py-3 px-4 font-medium text-sm">{t('table.createdAt')}</th>
                <th className="text-left py-3 px-4 font-medium text-sm">{t('table.lastUsedAt')}</th>
                <th className="text-right py-3 px-4 font-medium text-sm">{t('table.actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {apiKeys.map((key) => (
                <tr key={key.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-3 px-4">
                    <span className="font-medium">{key.name || t('unnamed')}</span>
                  </td>
                  <td className="py-3 px-4">
                    <code className="text-sm font-mono text-muted-foreground">
                      {key.keyPreview}
                    </code>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {formatDate(key.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground">
                    {key.lastUsedAt ? formatDate(key.lastUsedAt) : '-'}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCreateOrEdit(key)}
                        title={t('actions.edit')}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(key)}
                        title={t('actions.delete')}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ApiKeyDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        apiKey={selectedKey}
      />

      <ShowApiKeyDialog
        open={showKeyDialogOpen}
        onClose={() => {
          setShowKeyDialogOpen(false)
          setNewApiKey(null)
        }}
        keyValue={newApiKey?.keyValue || ''}
        name={newApiKey?.name}
        scopes={newApiKey?.scopes || []}
      />
    </div>
  )
}
