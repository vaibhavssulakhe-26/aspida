// WhatsApp Web DOM selectors. These change without notice; when the chat
// badges stop appearing, update this file only. Each entry is a list of
// fallbacks tried in order. Written from the public DOM structure; NOT yet
// verified against a logged-in session (see REGRESSION.md, m5).
export default {
  id: 'whatsapp',
  settingKey: 'chatWhatsApp',
  hosts: ['web.whatsapp.com'],
  // The open conversation panel. Absent until a chat is opened.
  container: ['#main', '[data-testid="conversation-panel-wrapper"]'],
  // Links inside message bubbles. WhatsApp renders message text in
  // span.selectable-text / .copyable-text; rows have role="row".
  links: [
    '#main [role="row"] .copyable-text a[href]',
    '#main [role="row"] a[href]',
    '#main .message-in a[href], #main .message-out a[href]',
  ],
};
