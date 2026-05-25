import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

type EditorChromeContextValue = {
  /** Site nav + editor toolbar hidden for more canvas space */
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
  isEditorPage: boolean;
};

const EditorChromeContext = createContext<EditorChromeContextValue | null>(null);

function isSurveyEditorPath(pathname: string): boolean {
  return /^\/admin\/surveys\/[^/]+$/.test(pathname);
}

export function EditorChromeProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isEditorPage = isSurveyEditorPath(pathname);
  const [hidden, setHiddenState] = useState(false);

  useEffect(() => {
    if (!isEditorPage) setHiddenState(false);
  }, [isEditorPage]);

  const setHidden = (value: boolean) => {
    if (isEditorPage) setHiddenState(value);
  };

  const value = useMemo(
    () => ({
      hidden: isEditorPage && hidden,
      setHidden,
      isEditorPage,
    }),
    [hidden, isEditorPage],
  );

  return <EditorChromeContext.Provider value={value}>{children}</EditorChromeContext.Provider>;
}

export function useEditorChrome(): EditorChromeContextValue {
  const ctx = useContext(EditorChromeContext);
  if (!ctx) {
    return {
      hidden: false,
      setHidden: () => {},
      isEditorPage: false,
    };
  }
  return ctx;
}
