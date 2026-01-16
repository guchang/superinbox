"use client"

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface ShowApiKeyDialogProps {
  open: boolean
  onClose: () => void
  keyValue: string
  name?: string
  scopes: string[]
}

export function ShowApiKeyDialog({ open, onClose, keyValue, name, scopes }: ShowApiKeyDialogProps) {
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(keyValue)
      setCopied(true)
      toast({
        title: '已复制',
        description: 'API 密钥已复制到剪贴板',
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: '复制失败',
        description: '无法复制到剪贴板',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">创建 API key</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-2">
            请将此 API key 保存在安全且易于访问的地方。出于安全原因，你将无法通过 API keys 管理界面再次查看它。如果你丢失了这个 key，将需要重新创建。
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* API Key display */}
          <div className="p-4 bg-muted rounded-lg font-mono text-base break-all select-all">
            {keyValue}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
          <Button onClick={handleCopy}>
            {copied ? '已复制' : '复制'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
