"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Plus, RefreshCw, Trash2, Edit } from 'lucide-react'
import type { ApiKey } from '@/types/api-key'
import { listApiKeys, deleteApiKey } from '@/lib/api/api-keys'
import { ApiKeyDialog } from '@/components/api-keys/api-key-dialog'
import { ShowApiKeyDialog } from '@/components/api-keys/show-api-key-dialog'

export default function ApiKeysPage() {
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
        title: '加载失败',
        description: error instanceof Error ? error.message : '无法加载 API 密钥列表',
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
    if (!confirm(`确定要删除 API 密钥 ${keyName} 吗？此操作无法撤销。`)) {
      return
    }

    try {
      await deleteApiKey(key.id)
      toast({
        title: 'API 密钥已删除',
        description: `密钥 ${key.name || key.id} 已成功删除`,
      })
      loadApiKeys()
    } catch (error) {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '无法删除 API 密钥',
        variant: 'destructive',
      })
    }
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API 密钥管理</h1>
        </div>
        <Button onClick={() => handleCreateOrEdit()}>
          <Plus className="mr-2 h-4 w-4" />
          创建
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>还没有 API 密钥</p>
          <p className="text-sm mt-2">点击上方“创建”按钮开始</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-medium text-sm">名称</th>
                <th className="text-left py-3 px-4 font-medium text-sm">Key</th>
                <th className="text-left py-3 px-4 font-medium text-sm">创建日期</th>
                <th className="text-left py-3 px-4 font-medium text-sm">最新使用日期</th>
                <th className="text-right py-3 px-4 font-medium text-sm">操作</th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {apiKeys.map((key) => (
                <tr key={key.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-3 px-4">
                    <span className="font-medium">{key.name || '未命名'}</span>
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
                        title="编辑"
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(key)}
                        title="删除"
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
