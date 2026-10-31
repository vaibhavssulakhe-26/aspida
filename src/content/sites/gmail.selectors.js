// Gmail DOM selectors. Gmail's class names are obfuscated but have been
// stable for years; still, update this file only when they change. Each
// entry is a list of fallbacks. Written from Gmail's public DOM structure;
// NOT yet verified against a logged-in session in this build (REGRESSION.md, m6).
//
// What Gmail's DOM exposes (and what it doesn't):
//  - sender display name + address: yes, as attributes on span[email]
//  - Reply-To: only if the user opens the "show details" dropdown; we never
//    click it, so it is usually unknown
//  - body links: yes, original href (Gmail adds data-saferedirecturl)
//  - SPF/DKIM/DMARC results: not in the DOM (only in "Show original")
export default {
  id: 'gmail',
  bannerSetting: 'gmailBanner',
  inboxSetting: 'gmailInboxHighlight',
  hosts: ['mail.google.com'],
  // One expanded message in a conversation.
  message: ['div.adn.ads', 'div.adn'],
  // Sender element; carries email="" and name="" attributes.
  sender: ['h3.iw span[email]', 'span.gD[email]'],
  // Rows of the "show details" table (present only when the user opens it).
  detailRows: ['table.ajC tr', '.ajA tr'],
  // Attributes on the message element that carry Gmail's message id (used
  // only to remember a minimized banner for this session).
  messageIdAttrs: ['data-legacy-message-id', 'data-message-id'],
  // Conversation subject (outside the message element).
  subject: ['h2.hP'],
  // Message body.
  body: ['div.a3s', 'div.ii.gt'],
  // Where the banner goes: inserted before this element.
  bannerBefore: ['div.ii.gt', 'div.a3s'],
  // Inbox list rows and the sender inside each row.
  inboxRow: ['tr.zA'],
  inboxSender: ['span.yP[email]', 'span.zF[email]', 'span[email]'],
};
