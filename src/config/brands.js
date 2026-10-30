// Brand -> official registrable domains, and the keywords that identify a
// claim to be that brand. Used by brand-claim, typosquat and sender checks.
//
// keywords: lowercase tokens matched on label/word boundaries in hostnames,
//   paths and display names. Keep them specific: short generic tokens such
//   as "pay" would cause false positives.
// domains: registrable domains the brand legitimately uses. A claim on any
//   other domain is reported as "claims to be X but domain is not Y".
export const BRANDS = [
  { name: 'SBI', keywords: ['sbi', 'onlinesbi', 'yonosbi', 'yono'], domains: ['sbi.co.in', 'onlinesbi.sbi', 'sbi', 'onlinesbi.com', 'sbicard.com', 'sbimf.com', 'sbilife.co.in', 'yonobusiness.sbi'] },
  { name: 'HDFC Bank', keywords: ['hdfc', 'hdfcbank'], domains: ['hdfcbank.com', 'hdfc.com', 'hdfclife.com', 'hdfcergo.com', 'hdfcsec.com', 'hdfcfund.com', 'hdfc.bank.in'] },
  { name: 'ICICI Bank', keywords: ['icici', 'icicibank'], domains: ['icicibank.com', 'icicidirect.com', 'iciciprulife.com', 'icicilombard.com', 'icici.bank.in'] },
  { name: 'Paytm', keywords: ['paytm'], domains: ['paytm.com', 'paytm.in', 'paytmbank.com', 'paytmmoney.com', 'paytmmall.com'] },
  { name: 'PhonePe', keywords: ['phonepe'], domains: ['phonepe.com'] },
  { name: 'Google Pay', keywords: ['googlepay', 'google-pay', 'gpay'], domains: ['google.com', 'google.co.in', 'g.co'] },
  { name: 'IRCTC', keywords: ['irctc'], domains: ['irctc.co.in', 'irctc.com', 'irctctourism.com'] },
  { name: 'Amazon', keywords: ['amazon'], domains: ['amazon.com', 'amazon.in', 'amazon.co.uk', 'amazon.de', 'amazon.co.jp', 'amazon.fr', 'amazon.ca', 'amazon.es', 'amazon.it', 'amazon.com.au', 'amazon.com.br', 'amazon.ae', 'amazon.sa', 'amazon.nl', 'amazon.se', 'amazon.pl', 'amazon.sg', 'amazon.com.mx', 'amazon.com.tr', 'amazon.eg', 'amazon.co.za', 'amazon.com.be', 'amazon.dev', 'amazonaws.com', 'amazonpay.in', 'amazon.jobs', 'aboutamazon.com', 'media-amazon.com', 'ssl-images-amazon.com', 'images-amazon.com', 'amazon.eu', 'primevideo.com', 'audible.com', 'audible.in'] },
  { name: 'Flipkart', keywords: ['flipkart'], domains: ['flipkart.com', 'flipkart.net', 'fkcdn.com', 'flixcart.com'] },
  { name: 'PayPal', keywords: ['paypal'], domains: ['paypal.com', 'paypal.me', 'paypalobjects.com', 'paypal-community.com'] },
  { name: 'Microsoft', keywords: ['microsoft', 'office365', 'outlook', 'onedrive', 'sharepoint'], domains: ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'office365.com', 'microsoftonline.com', 'sharepoint.com', 'onedrive.com', 'msn.com', 'bing.com', 'azure.com', 'windows.net', 'microsoft365.com', 'cloud.microsoft'] },
  { name: 'Apple', keywords: ['apple', 'icloud', 'appleid'], domains: ['apple.com', 'icloud.com', 'me.com', 'mzstatic.com', 'apple.news'] },
  { name: 'Google', keywords: ['google', 'gmail'], domains: ['google.com', 'google.co.in', 'gmail.com', 'googleusercontent.com', 'gstatic.com', 'youtube.com', 'goo.gl', 'googleapis.com', 'withgoogle.com', 'blog.google', 'g.co', 'googlemail.com'] },
  { name: 'Netflix', keywords: ['netflix'], domains: ['netflix.com', 'nflxext.com', 'nflximg.net', 'netflix.net'] },
  { name: 'Facebook', keywords: ['facebook'], domains: ['facebook.com', 'fb.com', 'fbcdn.net', 'facebook.net', 'meta.com', 'fb.me'] },
  { name: 'Instagram', keywords: ['instagram'], domains: ['instagram.com', 'cdninstagram.com', 'ig.me'] },
  { name: 'WhatsApp', keywords: ['whatsapp'], domains: ['whatsapp.com', 'whatsapp.net', 'wa.me'] },
  { name: 'Axis Bank', keywords: ['axisbank'], domains: ['axisbank.com', 'axisbank.co.in', 'axis.bank.in'] },
  { name: 'Kotak', keywords: ['kotak', 'kotakbank'], domains: ['kotak.com', 'kotakbank.com', 'kotaksecurities.com', 'kotak.bank.in'] },
  { name: 'Jio', keywords: ['jio', 'myjio', 'jiofiber'], domains: ['jio.com', 'ril.com', 'jiomart.com', 'jiocinema.com', 'jiosaavn.com', 'jiohotstar.com', 'jiofinance.com'] },
  { name: 'Airtel', keywords: ['airtel'], domains: ['airtel.in', 'airtel.com', 'airtelxstream.in', 'airtelpaymentsbank.com'] },
  { name: 'India Post', keywords: ['indiapost'], domains: ['indiapost.gov.in'] },
  { name: 'Income Tax India', keywords: ['incometax', 'incometaxindia'], domains: ['incometax.gov.in', 'incometaxindia.gov.in'] },
  { name: 'DHL', keywords: ['dhl'], domains: ['dhl.com', 'dhl.de', 'dhl.co.in', 'dhl.co.uk'] },
  { name: 'FedEx', keywords: ['fedex'], domains: ['fedex.com'] },
  { name: 'Coinbase', keywords: ['coinbase'], domains: ['coinbase.com'] },
  { name: 'Binance', keywords: ['binance'], domains: ['binance.com', 'binance.us', 'binance.org'] },
  { name: 'MetaMask', keywords: ['metamask'], domains: ['metamask.io'] },
  { name: 'DocuSign', keywords: ['docusign'], domains: ['docusign.com', 'docusign.net'] },
  { name: 'LinkedIn', keywords: ['linkedin'], domains: ['linkedin.com', 'licdn.com', 'lnkd.in'] },
];
