export interface Schema<T> {
  parse(value: unknown, path?: string): T;
  optional(): Schema<T | undefined>;
  default(value: T): Schema<T>;
}

class BaseSchema<T> implements Schema<T> {
  constructor(private readonly parser: (value: unknown, path: string) => T) {}

  parse(value: unknown, path = ""): T {
    return this.parser(value, path);
  }

  optional(): Schema<T | undefined> {
    return new BaseSchema((value, path) => {
      if (value === undefined) return undefined;
      return this.parse(value, path);
    });
  }

  default(defaultValue: T): Schema<T> {
    return new BaseSchema((value, path) => {
      if (value === undefined) return defaultValue;
      return this.parse(value, path);
    });
  }
}

type Shape = Record<string, Schema<unknown>>;
type InferShape<T extends Shape> = {
  [K in keyof T]: T[K] extends Schema<infer V> ? V : never;
};

export const schema = {
  string(): Schema<string> {
    return new BaseSchema((value, path) => {
      if (typeof value !== "string") {
        throw new Error(`Expected string at ${path || "$"}`);
      }
      return value;
    });
  },
  number(): Schema<number> {
    return new BaseSchema((value, path) => {
      if (typeof value !== "number") {
        throw new Error(`Expected number at ${path || "$"}`);
      }
      return value;
    });
  },
  boolean(): Schema<boolean> {
    return new BaseSchema((value, path) => {
      if (typeof value !== "boolean") {
        throw new Error(`Expected boolean at ${path || "$"}`);
      }
      return value;
    });
  },
  object<T extends Shape>(shape: T): Schema<InferShape<T>> {
    return new BaseSchema((value, path) => {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`Expected object at ${path || "$"}`);
      }

      const input = value as Record<string, unknown>;
      const output: Record<string, unknown> = {};

      for (const key of Object.keys(shape)) {
        output[key] = shape[key].parse(input[key], path ? `${path}.${key}` : key);
      }

      return output as InferShape<T>;
    });
  },
  unknown(): Schema<unknown> {
    return new BaseSchema((value) => value);
  },
};

export type Infer<T> = T extends Schema<infer V> ? V : never;
