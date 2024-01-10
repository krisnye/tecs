
import { type Schema as JSONSchema } from "@cfworker/json-schema";

import { type DeepReadonly, type Primitive, type StringKeyof } from "./types";

export type Schema = DeepReadonly<JSONSchema>;

interface JSONSchemaTypes {
  integer: number;
  number: number;
  string: string;
  boolean: boolean;
  object: object;
  null: null;
  array: Array<unknown>;
}

export type FromSchema<S> = DeepReadonly<MutableTypeFromSchema<S>>;

export type MutableTypeFromSchema<S> = S extends Schema
  ? S extends DeepReadonly<{ oneOf: Array<unknown> }>
    ? UnionTypeFromSchemaArray<S["oneOf"]>
    : S extends DeepReadonly<{ enum: Array<unknown> }>
    ? S["enum"][number]
    : S extends DeepReadonly<{ type: "array"; items: Schema }>
    ? Array<FromSchema<S["items"]>>
    : S extends DeepReadonly<{ properties: object }>
    ?
      {
        [K in RequiredPropertyNames<S>]: FromSchema<S["properties"][K]>;
      } & {
        [K in OptionalPropertyNames<S>]?: FromSchema<S["properties"][K]>;
      }
    : S extends DeepReadonly<Schema>
    ? S["type"] extends keyof JSONSchemaTypes
      ? JSONSchemaTypes[S["type"]]
      : {}
    : unknown
  : S extends Primitive
  ? S
  : never;

type UnionTypeFromSchemaArray<S> = S extends DeepReadonly<
  [infer A, infer B, ...infer Rest]
>
  ? A extends undefined
    ? never
    : B extends undefined
    ? FromSchema<A>
    : FromSchema<A> | FromSchema<B> | UnionTypeFromSchemaArray<Rest>
  : never;

type IsRequired<
  S extends Schema,
  P extends string,
  T,
  F,
> = S["required"] extends ReadonlyArray<string>
  ? P extends S["required"][number]
    ? T
    : F
  : F;

type RequiredPropertyNames<D extends Schema> = D extends DeepReadonly<{}>
  ? {
      [K in StringKeyof<D["properties"]>]: D["properties"][K] extends
        | DeepReadonly<Schema>
        | Primitive
        ? IsRequired<D, K, K, never>
        : never;
    }[StringKeyof<D["properties"]>]
  : never;

type OptionalPropertyNames<D extends Schema> = D extends DeepReadonly<{}>
  ? {
      [K in StringKeyof<D["properties"]>]: D["properties"][K] extends
        | DeepReadonly<Schema>
        | Primitive
        ? IsRequired<D, K, never, K>
        : never;
    }[StringKeyof<D["properties"]>]
  : never;
