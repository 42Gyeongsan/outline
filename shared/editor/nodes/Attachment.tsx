import { Token } from "markdown-it";
import { DownloadIcon, CaretDownIcon, CaretUpIcon } from "outline-icons";
import { NodeSpec, NodeType, Node as ProsemirrorNode } from "prosemirror-model";
import { Command, NodeSelection } from "prosemirror-state";
import * as React from "react";
import { useState } from "react";
import { Trans } from "react-i18next";
import styled from "styled-components";
import { Primitive } from "utility-types";
import { s } from "../../styles";
import { bytesToHumanReadable, getEventFiles } from "../../utils/files";
import { sanitizeUrl } from "../../utils/urls";
import insertFiles from "../commands/insertFiles";
import toggleWrap from "../commands/toggleWrap";
import FileExtension from "../components/FileExtension";
import Widget from "../components/Widget";
import { MarkdownSerializerState } from "../lib/markdown/serializer";
import attachmentsRule from "../rules/links";
import { ComponentProps } from "../types";
import Node from "./Node";

const PdfComponent = React.lazy(() => import("../components/PdfComponent"));

export default class Attachment extends Node {
  get name() {
    return "attachment";
  }

  get rulePlugins() {
    return [attachmentsRule];
  }

  get schema(): NodeSpec {
    return {
      attrs: {
        id: {
          default: null,
        },
        href: {
          default: null,
        },
        title: {},
        size: {
          default: 0,
        },
      },
      group: "block",
      defining: true,
      atom: true,
      parseDOM: [
        {
          priority: 100,
          tag: "a.attachment",
          getAttrs: (dom: HTMLAnchorElement) => ({
            id: dom.id,
            title: dom.innerText,
            href: dom.getAttribute("href"),
            size: parseInt(dom.dataset.size || "0", 10),
          }),
        },
      ],
      toDOM: (node) => [
        "a",
        {
          class: `attachment`,
          id: node.attrs.id,
          href: sanitizeUrl(node.attrs.href),
          download: node.attrs.title,
          "data-size": node.attrs.size,
        },
        String(node.attrs.title),
      ],
      toPlainText: (node) => node.attrs.title,
    };
  }

  handleSelect =
    ({ getPos }: ComponentProps) =>
    () => {
      const { view } = this.editor;
      const $pos = view.state.doc.resolve(getPos());
      const transaction = view.state.tr.setSelection(new NodeSelection($pos));
      view.dispatch(transaction);
    };

  component = (props: ComponentProps) => {
    const { isSelected, isEditable, theme, node } = props;
    const [preview, setPreview] = useState(false);
    const isPdf = node.attrs.title?.toLowerCase().endsWith(".pdf");

    return (
      <>
        <Widget
          icon={<FileExtension title={node.attrs.title} />}
          href={node.attrs.href}
          title={node.attrs.title}
          onMouseDown={this.handleSelect(props)}
          onDoubleClick={() => {
            this.editor.commands.downloadAttachment();
          }}
          onClick={(event) => {
            if (isEditable) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          context={
            node.attrs.href ? (
              <div>{bytesToHumanReadable(node.attrs.size || "0")}</div>
            ) : (
              <>
                <Trans>Uploading</Trans>…
              </>
            )
          }
          isSelected={isSelected}
          theme={theme}
        >
          {node.attrs.href && !isEditable && <DownloadIcon size={20} />}
        </Widget>
        {isPdf && (
          <div
            style={{ marginTop: "4px" }}
            onClick={() => setPreview(!preview)}
          >
            {
              <div>
                {preview && <PdfComponent {...props} />}
                <PreviewToggle onClick={() => setPreview(!preview)}>
                  {preview ? <CaretUpIcon /> : <CaretDownIcon />}
                </PreviewToggle>
              </div>
            }
          </div>
        )}
      </>
    );
  };

  commands({ type }: { type: NodeType }) {
    return {
      createAttachment: (attrs: Record<string, Primitive>) =>
        toggleWrap(type, attrs),
      deleteAttachment: (): Command => (state, dispatch) => {
        dispatch?.(state.tr.deleteSelection());
        return true;
      },
      replaceAttachment: (): Command => (state) => {
        if (!(state.selection instanceof NodeSelection)) {
          return false;
        }
        const { view } = this.editor;
        const { node } = state.selection;
        const { uploadFile, onFileUploadStart, onFileUploadStop } =
          this.editor.props;

        if (!uploadFile) {
          throw new Error("uploadFile prop is required to replace attachments");
        }

        if (node.type.name !== "attachment") {
          return false;
        }

        // create an input element and click to trigger picker
        const inputElement = document.createElement("input");
        inputElement.type = "file";
        inputElement.onchange = (event) => {
          const files = getEventFiles(event);
          void insertFiles(view, event, state.selection.from, files, {
            uploadFile,
            onFileUploadStart,
            onFileUploadStop,
            dictionary: this.options.dictionary,
            replaceExisting: true,
          });
        };
        inputElement.click();
        return true;
      },
      downloadAttachment: (): Command => (state) => {
        if (!(state.selection instanceof NodeSelection)) {
          return false;
        }
        const { node } = state.selection;

        // create a temporary link node and click it
        const link = document.createElement("a");
        link.href = node.attrs.href;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();

        // cleanup
        document.body.removeChild(link);
        return true;
      },
    };
  }

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    state.ensureNewLine();
    state.write(
      `[${node.attrs.title} ${node.attrs.size}](${node.attrs.href})\n\n`
    );
    state.ensureNewLine();
  }

  parseMarkdown() {
    return {
      node: "attachment",
      getAttrs: (tok: Token) => ({
        href: tok.attrGet("href"),
        title: tok.attrGet("title"),
        size: tok.attrGet("size"),
      }),
    };
  }
}

const PreviewToggle = styled.a`
  display: flex;
  flexDirection: 'column',
  width: 100%;
  background: ${s("background")};
  color: ${s("text")} !important;
  box-shadow: 0 0 0 1px ${s("divider")};
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  border-bottom-left-radius: 16px;
  border-bottom-right-radius: 16px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: ${(props) => props.theme.background};

  &:hover {
    background: ${(props) => props.theme.backgroundSecondary};
  }
`;
