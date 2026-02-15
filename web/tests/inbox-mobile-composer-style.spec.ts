import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const sourcePath = path.join(process.cwd(), 'src/components/inbox/expandable-input.tsx')

test.describe('Inbox mobile composer dark mode styles', () => {
  const source = readFileSync(sourcePath, 'utf8')

  test('uses a solid dark surface for the floating capture button', async () => {
    expect(source).toContain('dark:bg-popover/95')
    expect(source).toContain('dark:border-white/20')
    expect(source).toContain('dark:backdrop-blur-md')
  })

  test('uses a dedicated mobile dark surface for the expanded composer panel', async () => {
    expect(source).toContain('isMobile && isDark')
    expect(source).toContain('bg-popover/95 border-white/15 backdrop-blur-xl shadow-[0_24px_56px_rgba(0,0,0,0.55)]')
  })

  test('uses half-screen height for the mobile expanded composer', async () => {
    expect(source).toContain("const MOBILE_EXPANDED_HEIGHT = '50dvh'")
    expect(source).toContain('height: MOBILE_EXPANDED_HEIGHT')
  })
})
