import { useEffect, useMemo, type ReactNode } from 'react'
import type { Language } from '../../../shared/types'
import { I18nContext, createTranslator } from './translator'

export function I18nProvider({
  language,
  children
}: {
  language: Language
  children: ReactNode
}): React.JSX.Element {
  const translator = useMemo(() => createTranslator(language), [language])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return <I18nContext.Provider value={translator}>{children}</I18nContext.Provider>
}
