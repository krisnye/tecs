
export type StringKeyof<T> = T extends ReadonlyArray<unknown> ? Exclude<keyof T, keyof []> :  Exclude<keyof T, symbol | number>;

export type EntriesToObject<T extends ReadonlyArray<[string, unknown]>> = {
    [P in T[number] as P[0]]: P[1];
};

export interface WritableArrayLike<T>  {
    readonly length: number;
    [n: number]: T;
    [Symbol.iterator](): Iterator<T>
    slice(offset: number, length: number): WritableArrayLike<T>
}


export type Primitive = string | number | boolean | null | undefined;
export type Collection = Array<unknown> | Map<unknown, unknown> | Set<unknown>;
export type TypedArray =
  | Uint8Array
  | Int8Array
  | Uint16Array
  | Int16Array
  | Uint32Array
  | Int32Array
  | Float32Array
  | Float64Array;

export type DeepMutable<T> = T extends Primitive
  ? T
  : T extends ReadonlyArray<infer U>
  ? Array<DeepMutable<U>>
  : T extends {}
  ? {
      -readonly [P in keyof T]: DeepMutable<T[P]>;
    }
  : T;

export type DeepReadonly<T> = T extends Primitive
  ? T
  : T extends Array<infer U>
  ? ReadonlyArray<DeepReadonly<U>>
  : T extends {}
  ? {
      +readonly [P in keyof T]: DeepReadonly<T[P]>;
    }
  : Readonly<T>;

export type Simplify<T> = T extends Primitive
  ? T
  : T extends Array<infer A>
  ? Array<Simplify<A>>
  : T extends Set<infer A>
  ? Set<Simplify<A>>
  : T extends Map<infer A, infer B>
  ? Map<Simplify<A>, Simplify<B>>
  : T extends {}
  ? {
      [K in keyof T]: Simplify<T[K]>;
    }
  : T;

export type False<_A extends false> = true;
export type True<_A extends true> = true;
export type Extends<A, B> = A extends B ? true : false;
export type EquivalentObjectTypes<A, B> = A extends B
  ? B extends A
    ? true
    : false
  : false;

type StringToObject<A extends string> = { [key in A]: true };
export type EquivalentEnumTypes<
  A extends string,
  B extends string,
> = EquivalentObjectTypes<StringToObject<A>, StringToObject<B>>;

export type RequiredKeys<T extends object> = {
  [K in keyof T]-?: {} extends { [P in K]: T[K] } ? never : K;
}[keyof T];

export type OptionalKeys<T extends object> = Exclude<
  {
    [K in keyof T]: T extends Record<K, T[K]> ? never : K;
  }[keyof T],
  undefined
>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export type NoUnion<Key> =
  [Key] extends [UnionToIntersection<Key>] ? Key : never;

export type OmitNever<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};
export type OmitNeverOrUndefined<T> = {
  [K in keyof T as T[K] extends never | undefined ? never : K]: T[K];
};
