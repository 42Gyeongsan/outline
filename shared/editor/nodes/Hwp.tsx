import { Token } from "markdown-it";
import { InputRule } from "prosemirror-inputrules";
import { Node as ProsemirrorNode, NodeSpec, NodeType } from "prosemirror-model";
import { Command } from "prosemirror-state";
import * as React from "react";
import { Suspense } from "react";
import { MarkdownSerializerState } from "../lib/markdown/serializer";
import { ComponentProps } from "../types";
import Node from "./Node";

const HwpComponent = React.lazy(() => import("../components/HwpComponent"));

const HwpComponentWrapper = (props: ComponentProps) => (
  <Suspense fallback={null}>
    <HwpComponent {...props} />
  </Suspense>
);

export default class Hwp extends Node {
  get name() {
    return "hwp";
  }

  get schema(): NodeSpec {
    return {
      attrs: {
        src: {
          default: "",
        },
      },
      group: "block",
      atom: true,
      parseDOM: [
        {
          tag: "div[class=hwp-block]",
          getAttrs: (dom: HTMLDivElement) => ({
            src: dom.getAttribute("data-src"),
          }),
        },
      ],
      toDOM: (node) => [
        "div",
        {
          class: "hwp-block",
          "data-src": node.attrs.src,
        },
      ],
    };
  }

  component = HwpComponentWrapper;

  toMarkdown(state: MarkdownSerializerState, node: ProsemirrorNode) {
    state.write(`@[hwp](${node.attrs.src})`);
  }

  parseMarkdown() {
    return {
      node: "hwp",
      getAttrs: (tok: Token) => ({
        src: tok.attrGet("src"),
      }),
    };
  }

  commands({ type }: { type: NodeType }) {
    return {
      createHwp: (): Command => (state, dispatch) => {
        if (dispatch !== undefined) {
          dispatch(state.tr.replaceSelectionWith(type.create({ src: null })));
        }
        return true;
      },
    };
  }

  inputRules({ type }: { type: NodeType }) {
    return [
      new InputRule(/^@\[hwp\]\((?<src>.*?)\)$/, (state, match, start, end) => {
        const { src } = match.groups;
        const { tr } = state;

        if (src) {
          tr.replaceWith(start, end, type.create({ src }));
        }

        return tr;
      }),
    ];
  }
}
