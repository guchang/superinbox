"use client"

import { useState } from 'react'
import { useTranslations } from 'next-intl'
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
  const t = useTranslations('apiKeys.showDialog')
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(keyValue)
      setCopied(true)
      toast({
        title: t('toast.copySuccess.title'),
        description: t('toast.copySuccess.description'),
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast({
        title: t('toast.copyFailure.title'),
        description: t('toast.copyFailure.description'),
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">{t('title')}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed pt-2">
            {t('description')}
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
            {t('actions.close')}
          </Button>
          <Button onClick={handleCopy}>
            {copied ? t('actions.copied') : t('actions.copy')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
