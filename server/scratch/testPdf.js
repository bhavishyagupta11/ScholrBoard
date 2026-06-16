import './config/env.js';
import { v2 as cloudinary } from 'cloudinary';
import https from 'https';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function testPdf() {
  const dummyPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<< /Size 1 /Root 1 0 R >>\n%%EOF');
  
  const upload = (opts) => new Promise((resolve) => {
    cloudinary.uploader.upload_stream(opts, (err, res) => resolve(res)).end(dummyPdf);
  });

  const resRaw = await upload({ resource_type: 'raw', format: 'pdf' });
  const resImage = await upload({ resource_type: 'image', format: 'pdf' });
  
  const fetchHeaders = (url) => new Promise((resolve) => {
    https.get(url, (res) => resolve(res.headers['content-disposition']));
  });

  console.log('RAW URL:', resRaw.secure_url);
  console.log('RAW Content-Disposition:', await fetchHeaders(resRaw.secure_url));
  
  console.log('IMAGE URL:', resImage.secure_url);
  console.log('IMAGE Content-Disposition:', await fetchHeaders(resImage.secure_url));
  
  const modifiedUrl = resImage.secure_url.replace('/upload/', '/upload/fl_attachment:false/');
  console.log('MODIFIED URL Content-Disposition:', await fetchHeaders(modifiedUrl));
}
testPdf();
