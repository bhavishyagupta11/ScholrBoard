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

        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
      } catch (err) {
        if (!isMounted) return;
        const status = err.status ? `Status: ${err.status}` : 'Status: Unknown';
        const type = err.contentType ? `Type: ${err.contentType}` : 'Type: Unknown';
        setError(`Unable to load PDF preview. ${status} | ${type} | URL: ${endpointUrl}`);
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
