// Classify decoded QR text. Pure. The text is data: it is shown to the user
// and analysed, never opened.

export function classifyQrText(text) {
  const t = String(text || '').trim();
  if (/^https?:\/\//i.test(t)) return { type: 'url', url: t };
  if (/^upi:\/\/pay\?/i.test(t)) {
    let params;
    try {
      params = new URL(t).searchParams;
    } catch {
      return { type: 'text', text: t };
    }
    return {
      type: 'upi',
      payee: params.get('pa') || '',
      name: params.get('pn') || '',
      amount: params.get('am') || '',
      currency: params.get('cu') || 'INR',
      text: t,
    };
  }
  // Bare "www.example.com" style codes: treat as a URL without a scheme.
  if (/^www\.[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(t)) return { type: 'url', url: `http://${t}` };
  return { type: 'text', text: t };
}
