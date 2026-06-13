import { createContext, useContext } from 'react'
export const LangContext = createContext('zh')
export const useLang = () => useContext(LangContext)
export const LangProvider = ({ lang, children }) => (
  <LangContext.Provider value={lang}>{children}</LangContext.Provider>
)
