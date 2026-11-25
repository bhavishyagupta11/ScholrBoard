import { useState, useEffect } from 'react';
import { fetchBlob } from '../api/index.js';

export function usePdfBlob(endpointUrl) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let currentUrl = null;

    if (!endpointUrl) {
      setBlobUrl(null);
      return;
    }

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const { blob, contentType } = await fetchBlob(endpointUrl);
        
        if (!isMounted) return;

        if (!contentType.toLowerCase().includes('application/pdf')) {
          throw new Error('Invalid content type received.');
        }

        // Verify PDF magic header (%PDF-) before rendering/downloading blob so
        // HTML/JSON provider error payloads can never be treated as PDFs.
        const headerBytes = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
        const headerAscii = String.fromCharCode(...headerBytes);
        if (!headerAscii.startsWith('%PDF')) {
          let detail = 'Document payload is not a valid PDF binary.';
          try {
            const snippet = await blob.slice(0, 512).text();
            if (snippet.trim().startsWith('{')) {
              const parsed = JSON.parse(snippet);
              detail = parsed.message || detail;
            }
          } catch {
            // Keep default detail message
          }
          const badErr = new Error(detail);
          badErr.status = 400;
          badErr.contentType = contentType || 'Invalid binary payload';
          throw badErr;
        }

        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
      } catch (err) {
        if (!isMounted) return;
        const status = err.status ? `Status: ${err.status}` : 'Status: Unknown';
        const type = err.contentType ? `Type: ${err.contentType}` : 'Type: Unknown';
        const reason = err.message ? `${err.message} ` : '';
        setError(`${reason}(${status} | ${type} | URL: ${endpointUrl})`);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [endpointUrl]);

  return { blobUrl, loading, error };
}
