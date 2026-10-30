// Offline demo: demo/gmail-mock.html reproduces the Gmail structure the real
// selectors expect, so the Gmail module can be demonstrated and smoke-tested
// without an account. Only active on loopback hosts, on that one page.
import gmail from './gmail.selectors.js';

export default { ...gmail, id: 'demo-gmail', hosts: ['localhost', '127.0.0.1'], pathPrefix: '/gmail-mock.html' };
