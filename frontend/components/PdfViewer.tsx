'use client';

import { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Configure PDF.js worker
console.log('Configuring PDF.js worker...');

// In Next.js, public files are served from the root path
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PdfViewerProps {
  fileUrl: string;
}

export default function PdfViewer({ fileUrl }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    // Initial measurement
    updateContainerWidth();

    // Set up resize observer
    const resizeObserver = new ResizeObserver(updateContainerWidth);
    const currentRef = containerRef.current;
    
    if (currentRef) {
      resizeObserver.observe(currentRef);
    }

    // Clean up
    return () => {
      if (currentRef) {
        resizeObserver.unobserve(currentRef);
      }
    };
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
    setLoading(false);
  }

  function onDocumentLoadError(error: Error): void {
    console.error('Error loading PDF:', error);
    setError('Failed to load PDF. Please try downloading it instead.');
    setLoading(false);
  }

  function changePage(offset: number) {
    if (!numPages) return;
    setPageNumber(prevPageNumber => {
      const newPageNumber = prevPageNumber + offset;
      return Math.max(1, Math.min(numPages, newPageNumber));
    });
  }

  function previousPage() {
    changePage(-1);
  }

  function nextPage() {
    changePage(1);
  }

  function zoomIn() {
    setScale(prevScale => Math.min(prevScale + 0.2, 2.5));
  }

  function zoomOut() {
    setScale(prevScale => Math.max(0.5, prevScale - 0.2));
  }

  return (
    <div className="flex flex-col w-full h-full" ref={containerRef}>
      {loading && !error && (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <Skeleton className="h-[400px] w-full" />
          <div className="text-center mt-2">Loading PDF...</div>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-red-500 mb-2">{error}</div>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md"
          >
            Download PDF
          </a>
        </div>
      )}

      <div 
        className={`document-container flex flex-col items-center max-w-full overflow-y-auto overflow-x-hidden ${loading || error ? 'hidden' : ''}`}
        style={{ maxWidth: '100%' }}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<Skeleton className="h-[400px] w-full" />}
          className="pdf-document max-w-full"
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="pdf-page max-w-full"
            width={containerWidth ? containerWidth - 20 : undefined}
          />
        </Document>
      </div>

      {!loading && !error && (
        <div className="controls flex justify-between items-center mt-4 p-2 bg-muted rounded-md">
          <div className="flex gap-2">
            <Button
              onClick={previousPage}
              disabled={pageNumber <= 1}
              size="sm"
              variant="outline"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="flex items-center text-sm">
              Page {pageNumber} of {numPages || '-'}
            </span>

            <Button
              onClick={nextPage}
              disabled={!numPages || pageNumber >= numPages}
              size="sm"
              variant="outline"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button onClick={zoomOut} size="sm" variant="outline">
              <ZoomOut className="h-4 w-4" />
            </Button>

            <span className="flex items-center text-sm">
              {Math.round(scale * 100)}%
            </span>

            <Button onClick={zoomIn} size="sm" variant="outline">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
