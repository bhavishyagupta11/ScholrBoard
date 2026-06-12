import fs from 'node:fs';

const path = 'C:\\Users\\Sbhav\\.gemini\\antigravity\\brain\\130c8d93-91db-40e6-86d1-4bf98d79b24a\\logs\\lighthouse_report.json';

try {
  const rawData = fs.readFileSync(path, 'utf8');
  const report = JSON.parse(rawData);

  const score = report.categories.performance.score * 100;
  const lcp = report.audits['largest-contentful-paint'].displayValue;
  const tbt = report.audits['total-blocking-time'].displayValue;
  const cls = report.audits['cumulative-layout-shift'].displayValue;

  console.log('======================================');
  console.log('⚡ LIGHTHOUSE PERFORMANCE AUDIT RESULTS');
  console.log('======================================');
  console.log(`Performance Score: ${score}/100`);
  console.log(`Largest Contentful Paint (LCP): ${lcp}`);
  console.log(`Total Blocking Time (TBT): ${tbt}`);
  console.log(`Cumulative Layout Shift (CLS): ${cls}`);

  console.log('\n📥 --- LARGEST NETWORK REQUESTS ---');
  const networkRequests = report.audits['network-requests']?.details?.items || [];
  const sortedRequests = networkRequests
    .sort((a, b) => (b.transferSize || 0) - (a.transferSize || 0))
    .slice(0, 10);

  sortedRequests.forEach((req, idx) => {
    const sizeKb = ((req.transferSize || 0) / 1024).toFixed(2);
    console.log(`  ${idx + 1}. ${req.url} (${sizeKb} KB)`);
  });

} catch (err) {
  console.error('Failed to parse Lighthouse report:', err.message);
}
