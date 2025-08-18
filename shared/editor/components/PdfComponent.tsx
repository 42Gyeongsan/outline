import * as pdfjsLib from "pdfjs-dist";
import { PDFDocumentProxy } from "pdfjs-dist/types/src/display/api";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { s } from "../../styles";
import { ComponentProps } from "../types";
import useMeasure from "react-use-measure";

// Set up the worker using unpkg which is more reliable for matching npm versions
pdfjsLib.GlobalWorkerOptions.workerSrc = `/static/scripts/pdf.worker.min.mjs`;

const pdfCache = new Map<string, PDFDocumentProxy>();

const PdfComponent = (props: ComponentProps) => {
  const { node } = props;

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [measureRef, { width }] = useMeasure();
  const [errorMessage, setErrorMessage] = useState("");
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);

  useEffect(() => {
    if (!node) {
      setPdfDoc(null);
      return;
    }

    const href = node.attrs.href;
    const cachedPdf = pdfCache.get(href);

    if (cachedPdf) {
      setPdfDoc(cachedPdf);
      return;
    }

    const loadingTask = pdfjsLib.getDocument(href);

    const loadPdf = async () => {
      loadingTask.promise
        .then((doc) => {
          pdfCache.set(href, doc);
          setPdfDoc(doc);
          setErrorMessage("");
        })
        .catch((error) => {
          setErrorMessage(error.message);
          setPdfDoc(null);
        });
    };
    void loadPdf();
  }, [node?.attrs.href]);

  useEffect(() => {
    if (!pdfDoc || !canvasContainerRef.current || width <= 0) {
      return;
    }

    let rendering = false;
    const renderPdf = async () => {
      if (rendering) {
        return;
      }
      rendering = true;

      try {
        const container = canvasContainerRef.current;
        if (!container) {
          return;
        }

        container.innerHTML = ""; // Clear previous renders

        const page1 = await pdfDoc.getPage(1);
        const pageWidth = page1.getViewport({ scale: 1 }).width;
        const scale = width / pageWidth;

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          canvas.height = viewport.height;
          canvas.width = viewport.width;
          container.appendChild(canvas);

          if (context) {
            const renderContext = {
              canvasContext: context,
              viewport,
            };
            await page.render(renderContext).promise;
          } else {
            throw new Error(`Failed to get 2D context for page ${pageNum}`);
          }
        }
      } catch (e) {
        setErrorMessage(e.message);
      } finally {
        rendering = false;
      }
    };

    void renderPdf();
  }, [pdfDoc, width]);

  const a4height = width * 1.414;

  return (
    <Wrapper contentEditable={false} ref={measureRef}>
      <CanvasContainer
        $a4height={a4height}
        style={{ display: pdfDoc ? "block" : "none" }}
        ref={canvasContainerRef}
      />
      {errorMessage && (
        <div>
          <h1>Error loading PDF</h1>
          <p>{errorMessage}</p>
        </div>
      )}
    </Wrapper>
  );
};

const Wrapper = styled.div`
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  marginTop: 4px,
  position: relative;
`;

const CanvasContainer = styled.div<{ $a4height: number }>`
  box-shadow: 0 0 0 1px ${s("divider")};
  overflow: hidden;
  display: block;
  max-height: 80vh;
  overflow-y: auto;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;

  height: ${(props) => (props.$a4height > 0 ? `${props.$a4height}px` : "auto")};
  canvas {
    display: block;
  }
`;

export default PdfComponent;
