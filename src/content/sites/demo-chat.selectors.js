// Offline demo: demo/chat-mock.html imitates WhatsApp's structure so the
// chat scanner can be demonstrated and smoke-tested without a real account.
// Only active on loopback hosts, on that one page.
export default {
  id: 'demo-chat',
  settingKey: 'chatWhatsApp',
  hosts: ['localhost', '127.0.0.1'],
  pathPrefix: '/chat-mock.html',
  container: ['#main'],
  links: ['#main [role="row"] .copyable-text a[href]'],
};
