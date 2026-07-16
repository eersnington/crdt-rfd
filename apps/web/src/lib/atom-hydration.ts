import * as Atom from "effect/unstable/reactivity/Atom";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<JsonValue>
  | { readonly [key: string]: JsonValue };

export interface DehydratedAtomValue {
  readonly "~effect/reactivity/DehydratedAtom": true;
  readonly key: string;
  readonly value: JsonValue;
  readonly dehydratedAt: number;
}

export const dehydrateAtom = (atom: Atom.Atom<any>, value: unknown): DehydratedAtomValue => {
  if (!Atom.isSerializable(atom)) {
    throw new Error("Cannot dehydrate an atom without serialization metadata");
  }

  return {
    "~effect/reactivity/DehydratedAtom": true,
    key: atom[Atom.SerializableTypeId].key,
    value: atom[Atom.SerializableTypeId].encode(value) as JsonValue,
    dehydratedAt: Date.now(),
  };
};
