/** Open WhatsApp click-to-chat links from the browser (one or many). */
export function openWhatsAppLinks(urls: string[] | string | undefined | null) {
  if (!urls) return;
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  // Browsers block many popups — open first immediately, stagger the rest lightly
  list.slice(0, 8).forEach((url, i) => {
    window.setTimeout(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    }, i * 350);
  });
}
