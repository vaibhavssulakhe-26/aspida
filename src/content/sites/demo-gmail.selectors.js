// Offline demo: demo/gmail-mock.html reproduces the Gmail structure the real
// selectors expect, so the Gmail module can be demonstrated and smoke-tested
// without an account. Only active on loopback hosts, on that one page.
import gmail from './gmail.selectors.js';
import { DEMO_HOSTS } from './demo-hosts.js';

export default { ...gmail, id: 'demo-gmail', hosts: DEMO_HOSTS, pathPrefix: '/gmail-mock.html' };
