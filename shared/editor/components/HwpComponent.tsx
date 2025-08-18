import { Viewer as HWPViewer } from "hwp.js";
import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { ComponentProps } from "../types";
import useMeasure from "react-use-measure";

type Props = ComponentProps;

const HwpComponent = (props: Props) => {
  const { node } = props;
  const { src } = node.attrs;

  // 1. Shadow DOM을 호스팅할 엘리먼트의 ref
  const shadowHostRef = useRef<HTMLDivElement | null>(null);

  // 2. Shadow DOM 내부의 실제 뷰어 컨테이너를 저장할 state
  const [viewerContainer, setViewerContainer] = useState<HTMLDivElement | null>(
    null
  );

  const [measureRef, { width }] = useMeasure();
  const [errorMessage, setErrorMessage] = useState("");

  // 3. Shadow DOM을 생성하는 useEffect
  useEffect(() => {
    if (shadowHostRef.current) {
      // Shadow DOM이 이미 생성되었다면 다시 생성하지 않음
      if (!shadowHostRef.current.shadowRoot) {
        const shadowRoot = shadowHostRef.current.attachShadow({ mode: "open" });
        const container = document.createElement("div");
        shadowRoot.appendChild(container);
        setViewerContainer(container);
      }
    }
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  const showViewer = useCallback(
    (fileSrc: string | File, container: HTMLDivElement) => {
      const reader = new FileReader();

      reader.onloadend = (result) => {
        const bstr = result.target?.result;

        if (bstr) {
          try {
            // 이전 뷰어 내용 지우기
            container.innerHTML = "";
            new HWPViewer(container, bstr as Uint8Array, {
              type: "binary",
            });
          } catch (e) {
            setErrorMessage(e.message);
          }
        }
      };

      if (typeof fileSrc === "string") {
        void fetch(fileSrc)
          .then((res) => res.blob())
          .then((blob) => {
            const file = new File([blob], "hwp.hwp", {
              type: "application/x-hwp",
            });
            reader.readAsBinaryString(file);
          });
      } else {
        reader.readAsBinaryString(fileSrc);
      }
    },
    []
  );

  // 4. viewerContainer가 준비되면 HWP 뷰어를 실행하는 useEffect
  useEffect(() => {
    if (src && viewerContainer) {
      showViewer(src, viewerContainer);
    }
  }, [src, showViewer, viewerContainer]);

  const pageWidth = 1149; // hwp.js uses fixed width for docs.
  const zoom = width ? width / pageWidth : 1;

  return (
    <div contentEditable={false} ref={measureRef}>
      {/* 5. Viewer가 Shadow DOM의 호스트 역할을 하고 zoom 스타일을 적용 */}
      <Viewer
        ref={shadowHostRef}
        style={{
          zoom,
        }}
      />
      {errorMessage && (
        <div>
          <h1>Error</h1>
          <p>{errorMessage}</p>
        </div>
      )}
    </div>
  );
};

const Viewer = styled.div`
  overflow: hidden;
  display: block; // Shadow Host는 inline이 될 수 없으므로 block으로 명시
`;

export default HwpComponent;
