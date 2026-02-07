/**
 * FirestoreDataHandler: Chainable utility for Firestore data transformation.
 * Usage:
 *   new FirestoreDataHandler(data)
 *     .serializeTimestamps()
 *     .serializeLocationObject()
 *     .value;
 */
class FirestoreDataHandler {
  data: unknown;

  constructor(data: unknown) {
    this.data = data;
  }

  /**
   * Recursively converts all Firestore Timestamp or Date properties in an object to ISO strings.
   * Supports nested objects and arrays.
   */
  serializeTimestamps(): this {
    const convert = (value: unknown): unknown => {
      if (value == null) return value;
      if (
        typeof value === 'object' &&
        value !== null &&
        'toDate' in value &&
        typeof (value as Record<string, unknown>).toDate === 'function'
      ) {
        return (value as { toDate(): Date }).toDate().toISOString();
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (Array.isArray(value)) {
        return value.map(convert);
      }
      if (typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const key in value) {
          const objValue = value as Record<string, unknown>;
          result[key] = convert(objValue[key]);
        }
        return result;
      }
      return value;
    };
    this.data = convert(this.data);
    return this;
  }

  get value() {
    return this.data;
  }
}

export { FirestoreDataHandler };
