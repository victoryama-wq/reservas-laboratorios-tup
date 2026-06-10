import {DocumentData, Timestamp} from "firebase-admin/firestore";

/**
 * Removes undefined values before writing to Firestore.
 *
 * @param {unknown} value Value to clean.
 * @return {unknown} Clean value.
 */
export function removeUndefinedValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
        .filter((item) => item !== undefined)
        .map((item) => removeUndefinedValues(item));
  }

  if (value instanceof Timestamp || value instanceof Date) {
    return value;
  }

  if (!isPlainRecord(value)) {
    return value;
  }

  return Object.entries(value).reduce<DocumentData>(
      (clean, [key, item]) => {
        if (item !== undefined) {
          clean[key] = removeUndefinedValues(item);
        }

        return clean;
      },
      {},
  );
}

/**
 * Checks whether a value is a plain object.
 *
 * @param {unknown} value Value to check.
 * @return {boolean} Whether value is plain object.
 */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (Object.prototype.toString.call(value) !== "[object Object]") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
