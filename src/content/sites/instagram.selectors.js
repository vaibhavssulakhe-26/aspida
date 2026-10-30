// Instagram Web direct messages. Class names are obfuscated, so we rely on
// URL path, ARIA roles and the l.instagram.com link wrapper. External links
// in DMs are wrapped as https://l.instagram.com/?u=<encoded>; the pipeline
// unwraps that parameter locally. Update here only. NOT yet verified against
// a logged-in session (see REGRESSION.md, m5).
export default {
  id: 'instagram',
  settingKey: 'chatInstagram',
  hosts: ['www.instagram.com'],
  pathPrefix: '/direct/',
  container: ['[role="main"] [role="grid"]', '[aria-label^="Messages in conversation"]', '[role="main"]'],
  links: [
    '[role="main"] [role="grid"] a[href^="https://l.instagram.com/"]',
    '[role="main"] [role="row"] a[href^="http"]',
    '[role="main"] a[href^="https://l.instagram.com/"]',
  ],
};
