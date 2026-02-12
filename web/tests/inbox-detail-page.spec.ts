import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const detailPagePath = path.join(process.cwd(), 'src/app/[locale]/(dashboard)/inbox/[id]/page.tsx')
const zhMessagesPath = path.join(process.cwd(), 'src/messages/zh-CN.json')
const enMessagesPath = path.join(process.cwd(), 'src/messages/en.json')

test.describe('Inbox detail page refactor contract', () => {
  const source = readFileSync(detailPagePath, 'utf8')

  test('defaults to edit mode and supports read-only mode', async () => {
    expect(source).toContain("useState<'edit' | 'readOnly'>('edit')")
    expect(source).toContain("viewMode === 'readOnly' || !canEditItem")
    expect(source).toContain("t('edit.mode.readOnly')")
  })

  test('uses more menu for secondary actions and removes refresh action', async () => {
    expect(source).toContain("aria-label={t('actions.more')}")
    expect(source).toContain("t('actions.reclassify')")
    expect(source).toContain("t('actions.redistribute')")
    expect(source).toContain("t('actions.viewProperties')")
    expect(source).not.toContain("t('actions.refresh')")
  })

  test('moves properties into right sheet and shows autosave status next to editor area', async () => {
    expect(source).toContain('<Sheet open={isPropertiesOpen} onOpenChange={setIsPropertiesOpen}>')
    expect(source).toContain("!isReadOnlyMode && autoSaveLabel")
  })
})

test.describe('Inbox detail i18n keys', () => {
  test('contains new zh-CN keys for more menu and read-only mode', async () => {
    const zh = JSON.parse(readFileSync(zhMessagesPath, 'utf8'))
    expect(zh.inboxDetail.actions.more).toBe('更多')
    expect(zh.inboxDetail.actions.viewProperties).toBe('查看记录属性')
    expect(zh.inboxDetail.edit.mode.readOnly).toBe('只读')
  })

  test('contains new en keys for more menu and read-only mode', async () => {
    const en = JSON.parse(readFileSync(enMessagesPath, 'utf8'))
    expect(en.inboxDetail.actions.more).toBe('More')
    expect(en.inboxDetail.actions.viewProperties).toBe('View item properties')
    expect(en.inboxDetail.edit.mode.readOnly).toBe('Read-only')
  })
})
