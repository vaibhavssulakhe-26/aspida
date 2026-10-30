// Telegram Web DOM selectors (both clients). Update here only.
//   /k/ client: .bubbles-inner > .bubble, links are a.anchor-url
//   /a/ client: .messages-container .Message, links inside .text-content
// Written from the public DOM structure; NOT yet verified against a
// logged-in session (see REGRESSION.md, m5).
export default {
  id: 'telegram',
  settingKey: 'chatTelegram',
  hosts: ['web.telegram.org'],
  container: ['.bubbles-inner', '.messages-container', '#column-center'],
  links: [
    '.bubbles-inner .bubble .message a[href]',
    '.messages-container .Message .text-content a[href]',
    '.bubble a.anchor-url[href]',
  ],
};
