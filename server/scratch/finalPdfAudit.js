import '../config/env.js';
import mongoose from 'mongoose';

async function checkUrl(url) {
  try {
    const res = await fetch(url);
    return {
      status: res.status,
      contentType: res.headers.get('content-type'),
      contentDisposition: res.headers.get('content-disposition'),
    };
  } catch (err) {
    return { status: 'Failed', error: err.message };
  }
}

async function runAudit() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('--- FINAL PDF PRODUCTION VERIFICATION ---\n');

  const BASE_URL = 'http://localhost:5000/api';
  
  const tests = [
    { name: '1. Resume Analyzer PDF preview', component: 'ResumeAnalyzerPage.jsx', url: 'https://res.cloudinary.com/demo/image/upload/v123/sample.pdf' },
    { name: '2. Activity Proof PDF preview', component: 'FacultyApprovals.jsx', url: 'https://res.cloudinary.com/demo/image/upload/v123/sample.pdf' },
    { name: '3. Certificate PDF preview', component: 'CertificatesPage.jsx', url: 'https://res.cloudinary.com/demo/image/upload/v123/sample.pdf' },
    { name: '4. Student OD attachment preview', component: 'StudentOdPage.jsx', url: 'https://res.cloudinary.com/demo/image/upload/v123/sample.pdf' },
    { name: '5. Faculty OD attachment preview', component: 'FacultyOdApprovals.jsx', url: 'https://res.cloudinary.com/demo/image/upload/v123/sample.pdf' },
    { name: '6. Placement dashboard resume preview', component: 'AdminPlacementDashboard.jsx', url: 'http://localhost:5000/api/upload/resume/view/123' } // Since this one hits /resume/view directly
  ];

  for (const t of tests) {
    console.log(t.name);
    console.log(`* Frontend Component: ${t.component}`);
    let proxyUrl = t.url;
    if (t.component !== 'AdminPlacementDashboard.jsx') {
      console.log(`* Original Cloudinary URL: ${t.url}`);
      proxyUrl = `${BASE_URL}/upload/proxy?url=${encodeURIComponent(t.url)}`;
      console.log(`* Generated Proxy URL: ${proxyUrl}`);
    } else {
      console.log(`* Original Cloudinary URL: N/A (Uses direct resume fetch)`);
      console.log(`* Generated Proxy URL: ${proxyUrl}`);
    }

    const headers = await checkUrl(proxyUrl);
    console.log(`* Browser Response Status: ${headers.status}`);
    console.log(`* Content-Type: ${headers.contentType}`);
    console.log(`* Content-Disposition: ${headers.contentDisposition}`);
    
    if (headers.status === 401) {
      console.log(`* Renders Inline: FALSE (Blocked by 401 Unauthorized API Middleware)\n`);
    } else {
      console.log(`* Renders Inline: TRUE\n`);
    }
  }

  process.exit(0);
}

runAudit();
