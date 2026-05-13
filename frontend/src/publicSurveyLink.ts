/** Полная URL страницы прохождения анкеты для респондента. */
export function getPublicSurveyUrl(surveyId: string): string {
  return new URL(`/s/${encodeURIComponent(surveyId)}`, window.location.origin).href;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
