import { assert, expect, test, describe, vi } from "vitest";
import * as Y from "yjs";
import { store, Store } from "rocky7";
import { createBridge } from "./bridge";

export function getYjsDoc() {
  const ydoc = new Y.Doc();

  // You can define a Y.Map as a top-level type or a nested type

  // Method 1: Define a top-level type
  const ymap = ydoc.getMap("user");
  // Method 2: Define Y.Map that can be included into the Yjs document
  const ymapNested = new Y.Map();

  // Nested types can be included as content into any other shared type
  ymap.set("profile", ymapNested);

  // Common methods
  ymapNested.set("name", "John Doe"); // value can be anything json-encodable

  const yArray = new Y.Array();
  ymap.set("friends", yArray);
  yArray.push([1, 2, 3]);

  return ydoc;
}
export function getStore<T = unknown>(state: T = {} as T) {
  const s = store<T>(state);
  return s;
}

describe("Basic Implementation of YJS Bridge", (test) => {
  test("YJS Bridge", () => {
    const ydoc = getYjsDoc();
    const store = getStore<{ friends: number[] }>();
    const yUserMap = ydoc.get("user") as Y.Map<any>;
    const bridge = createBridge(yUserMap, store);

    const yArray = yUserMap.get("friends");
    yArray.push([4, 5]);

    store.value.friends.push(6, 7);
    store.value.friends.pop();
    expect(JSON.stringify(ydoc.get("user").toJSON())).toBe(
      JSON.stringify(store.value)
    );
    bridge.unbind();
  });
});
