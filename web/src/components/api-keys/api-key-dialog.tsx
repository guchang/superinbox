"use client"

import { useState, useEffect } from 'react'
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

interface ApiKeyDialogProps {
  open: boolean
  onClose: (createdKey?: { keyValue: string; name?: string; scopes: string[] }) => void
  apiKey?: ApiKey
}

export function ApiKeyDialog({ open, onClose, apiKey }: ApiKeyDialogProps) {
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
        title: '权限不能为空',
        description: '请至少选择一个权限范围',
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
          title: 'API 密钥已更新',
          description: '权限和名称已成功更新',
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
        title: isEdit ? '更新失败' : '创建失败',
        description: error instanceof Error ? error.message : '操作失败',
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
            {isEdit ? '编辑 API 密钥' : '创建新的 API 密钥'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? '修改 API 密钥的名称和权限'
              : '创建新的 API 密钥以程序化访问 SuperInbox'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">名称（可选）</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：Third Party App"
            />
            <p className="text-xs text-muted-foreground">
              为 API 密钥设置一个便于识别的名称
            </p>
          </div>

          <div className="space-y-4">
            <Label>权限范围</Label>
            {SCOPE_GROUPS.map((group) => (
              <div key={group.label} className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {group.label}
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
                          {scope.label}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {scope.description}
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
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? '处理中...' : isEdit ? '保存更改' : '创建密钥'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
