// Loopback host names the offline demo pages may be opened on. Besides
// localhost and 127.0.0.1 this includes 0.0.0.0, the link that
// `python3 -m http.server` prints on Linux (it loads there, unlike on
// Windows), and the IPv6 loopback, as location.hostname reports it.
export const DEMO_HOSTS = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'];
