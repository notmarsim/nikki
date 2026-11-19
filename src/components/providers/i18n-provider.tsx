"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  getModuleName,
  getSectionName,
  translate,
  type AppLanguage,
  type I18nKey,
} from "@/lib/i18n";

interface I18nContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: I18nKey) => string;
  tr: (en: string, pt: string) => string;
  moduleName: (moduleId: string, fallbackName: string) => string;
  sectionName: (sectionKey: string, fallbackName: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  language: "en-US",
  setLanguage: () => {},
  t: (key) => translate("en-US", key),
  tr: (en) => en,
  moduleName: (_id, fallback) => fallback,
  sectionName: (_key, fallback) => fallback,
});

export function I18nProvider({
  initialLanguage = "en-US",
  children,
}: {
  initialLanguage?: AppLanguage;
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState<AppLanguage>(initialLanguage);

  useEffect(() => {
    setLanguage(initialLanguage);
  }, [initialLanguage]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language === "pt-BR" ? "pt-BR" : "en";
    }
  }, [language]);

  const value: I18nContextValue = {
    language,
    setLanguage,
    t: (key) => translate(language, key),
    tr: (en, pt) => (language === "pt-BR" ? pt : en),
    moduleName: (id, fallback) => getModuleName(language, id, fallback),
    sectionName: (key, fallback) => getSectionName(language, key, fallback),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
