import * as Y from "yjs";
import { Store, Observable, Change } from "rocky7";
import {
  isJSONArray,
  isJSONObject,
  notImplemented,
  toPlainValue,
  toYDataType,
} from "./util";
import { JSONArray, JSONObject, JSONValue } from "./types";

function applyYEvent<T extends JSONValue>(base: T, event: Y.YEvent<any>) {
  if (event instanceof Y.YMapEvent && isJSONObject(base)) {
    const source = event.target as Y.Map<any>;

    event.changes.keys.forEach((change, key) => {
      switch (change.action) {
        case "add":
        case "update":
          base[key] = toPlainValue(source.get(key));
          break;
        case "delete":
          delete base[key];
          break;
      }
    });
  } else if (event instanceof Y.YArrayEvent && isJSONArray(base)) {
    const arr = base as unknown as any[];

    let retain = 0;
    event.changes.delta.forEach((change) => {
      if (change.retain) {
        retain += change.retain;
      }
      if (change.delete) {
        arr.splice(retain, change.delete);
      }
      if (change.insert) {
        if (Array.isArray(change.insert)) {
          arr.splice(retain, 0, ...change.insert.map(toPlainValue));
        } else {
          arr.splice(retain, 0, toPlainValue(change.insert));
        }
        retain += change.insert.length;
      }
    });
  }
}

function applyYEvents(target: any, events: Y.YEvent<any>[]) {
  for (const event of events) {
    const base = event.path.reduce((obj, step) => {
      // @ts-ignore
      return obj[step];
    }, target);

    applyYEvent(base, event);
  }
}
export function createBridge<T = unknown>(
  yObj: Y.Map<any> | Y.Array<any>,
  store: Store<T>
) {
  const docContent = yObj.toJSON();
  Object.keys(docContent).forEach(
    (k) => ((store.value as any)[k] = (docContent as any)[k])
  );

  // todo: find better functional way then these two flags
  let ignoreStoreChanges = false;
  let ignoreYChanges = false;

  const YObserver = (events: Y.YEvent<any>[]) => {
    if (ignoreYChanges) return;
    ignoreStoreChanges = true;
    applyYEvents(store.value, events);
    ignoreStoreChanges = false;
  };

  yObj.observeDeep(YObserver);

  const storeObserver = (changes: Change[]) => {
    if (ignoreStoreChanges) return;
    changes.forEach((change) => {
      ignoreYChanges = true;
      applyChange(yObj, change);
      ignoreYChanges = false;
    });
  };

  Observable.observe(store.value as any, storeObserver);

  const unbind = () => {
    yObj.unobserveDeep(YObserver);
    Observable.unobserve(store.value as any);
  };
  return { unbind };
}

function applyChange(target: Y.Map<any> | Y.Array<any>, patch: Change) {
  const { path, type, value } = patch;

  if (!path.length) {
    if (target instanceof Y.Map && isJSONObject(value)) {
      target.clear();
      for (const k in value) {
        target.set(k, toYDataType(value[k]));
      }
    } else if (target instanceof Y.Array && isJSONArray(value)) {
      target.delete(0, target.length);
      target.push(value.map(toYDataType));
    }
    return;
  }

  let base = target;
  for (let i = 0; i < path.length - 1; i++) {
    const step = path[i];
    base = base.get(step as never);
  }

  const property = path[path.length - 1];

  if (base instanceof Y.Map && typeof property === "string") {
    switch (type) {
      case "insert":
        base.set(property, toYDataType(value));
        break;
      case "update":
        base.set(property, toYDataType(value));
        break;
      case "delete":
        base.delete(property);
        break;
    }
  } else if (base instanceof Y.Array && typeof property === "number") {
    switch (type) {
      case "insert":
        base.insert(property, [toYDataType(value)]);
        break;
      case "update":
        base.delete(property);
        base.insert(property, [toYDataType(value)]);
        break;
      case "delete":
        base.delete(property);
        break;
    }
  }
}
