import type { Message } from "../api/types.js";
import { isToolOnly } from "./content-parser.js";

export interface MessageItem {
  kind: "message";
  message: Message;
  ordinals: number[];
}

export interface ToolGroupItem {
  kind: "tool-group";
  messages: Message[];
  ordinals: number[];
  timestamp: string;
}

export type DisplayItem = MessageItem | ToolGroupItem;

/**
 * Groups consecutive tool-only assistant messages into
 * compact display items. Non-tool messages pass through
 * as individual items.
 */
export function buildDisplayItems(
  messages: Message[],
): DisplayItem[] {
  const items: DisplayItem[] = [];
  let toolAcc: Message[] = [];

  for (const msg of messages) {
    if (isToolOnly(msg)) {
      toolAcc.push(msg);
    } else {
      const [firstTool] = toolAcc;
      if (firstTool) {
        items.push({
          kind: "tool-group",
          messages: toolAcc,
          ordinals: toolAcc.map((m) => m.ordinal),
          timestamp: firstTool.timestamp,
        });
        toolAcc = [];
      }
      items.push({
        kind: "message",
        message: msg,
        ordinals: [msg.ordinal],
      });
    }
  }

  const [lastFirstTool] = toolAcc;
  if (lastFirstTool) {
    items.push({
      kind: "tool-group",
      messages: toolAcc,
      ordinals: toolAcc.map((m) => m.ordinal),
      timestamp: lastFirstTool.timestamp,
    });
  }

  return items;
}
