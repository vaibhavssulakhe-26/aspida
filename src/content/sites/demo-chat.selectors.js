// Offline demo: demo/chat-mock.html imitates WhatsApp's structure so the
// chat scanner can be demonstrated and smoke-tested without a real account.
// Only active on loopback hosts, on that one page.
import { DEMO_HOSTS } from './demo-hosts.js';

export default {
  id: 'demo-chat',
  settingKey: 'chatWhatsApp',
  hosts: DEMO_HOSTS,
  pathPrefix: '/chat-mock.html',
  container: ['#main'],
  links: ['#main [role="row"] .copyable-text a[href]'],
};
