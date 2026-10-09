export const TABS = ['projects', 'freeRam', 'docker', 'settings'] as const
export type TabId = (typeof TABS)[number]

export const tabId = (tab: TabId): string => `tab-${tab}`
export const panelId = (tab: TabId): string => `panel-${tab}`
