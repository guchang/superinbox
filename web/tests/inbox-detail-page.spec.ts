import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const detailPagePath = path.join(process.cwd(), 'src/app/[locale]/(dashboard)/inbox/[id]/page.tsx')
const imageGalleryPath = path.join(process.cwd(), 'src/components/inbox/image-gallery.tsx')
const zhMessagesPath = path.join(process.cwd(), 'src/messages/zh-CN.json')
const enMessagesPath = path.join(process.cwd(), 'src/messages/en.json')

test.describe('Inbox detail page refactor contract', () => {
  const source = readFileSync(detailPagePath, 'utf8')
  const imageGallerySource = readFileSync(imageGalleryPath, 'utf8')

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

  test('moves AI analysis from main content to properties sheet', async () => {
    expect(source).not.toContain('item.analysis && (item.analysis.summary || entityEntries.length > 0) && (')
    expect(source).toContain('const hasAnalysisSection = hasAnalysisSummary || entityEntries.length > 0')
    expect(source).toContain('{hasAnalysisSection && (')
    expect(source).toContain("t('metadata.category')")
    expect(source).toContain('const isManualCategoryStatus = item.status === ItemStatus.MANUAL')
    expect(source).toContain('const showCategoryConfidence = hasAnalysisConfidence && !isManualCategoryStatus')
    expect(source).toContain("t('sections.analysis')")
    expect(source).toContain("t('analysis.summary')")
    expect(source).toContain("t('analysis.entities')")
    expect(source).toContain("t('analysis.confidence')")
    expect(source).toContain("t('status.manual')")
    expect(source).not.toContain('initialAICategoryRef')
    expect(source).toContain('formatEntityTypeLabel(type)')
    expect(source).toContain('const MAX_VISIBLE_ENTITY_VALUES = 6')
    expect(source).toContain("hiddenCount: Math.max(0, uniqueValues.length - MAX_VISIBLE_ENTITY_VALUES)")
    expect(source).not.toContain("t('metadata.id')")

    const sourceMatches = source.match(/t\('metadata\.source'\)/g) ?? []
    expect(sourceMatches).toHaveLength(1)
  })

  test('uses detailTypeAware attachment variant on detail page', async () => {
    expect(source).toContain('variant="detailTypeAware"')
  })

  test('prioritizes custom renderTrigger before grid layout in ImageGallery', async () => {
    const renderTriggerIndex = imageGallerySource.indexOf('if (renderTrigger) {')
    const isGridIndex = imageGallerySource.indexOf('if (isGrid) {')

    expect(renderTriggerIndex).toBeGreaterThan(-1)
    expect(isGridIndex).toBeGreaterThan(-1)
    expect(renderTriggerIndex).toBeLessThan(isGridIndex)
  })
})

test.describe('Inbox detail i18n keys', () => {
  test('contains zh-CN keys for detail header and manual status', async () => {
    const zh = JSON.parse(readFileSync(zhMessagesPath, 'utf8'))
    expect(zh.inboxDetail.actions.more).toBe('更多')
    expect(zh.inboxDetail.actions.viewProperties).toBe('查看记录属性')
    expect(zh.inboxDetail.edit.mode.readOnly).toBe('只读')
    expect(zh.inboxDetail.status.manual).toBe('手动')
    expect(zh.commandSearch.status.manual).toBe('手动')
  })

  test('contains en keys for detail header and manual status', async () => {
    const en = JSON.parse(readFileSync(enMessagesPath, 'utf8'))
    expect(en.inboxDetail.actions.more).toBe('More')
    expect(en.inboxDetail.actions.viewProperties).toBe('View item properties')
    expect(en.inboxDetail.edit.mode.readOnly).toBe('Read-only')
    expect(en.inboxDetail.status.manual).toBe('Manual')
    expect(en.commandSearch.status.manual).toBe('Manual')
  })
})
