import { Schema } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type * as Hydration from "effect/unstable/reactivity/Hydration";

export type DehydratedAtomValue = Omit<Hydration.DehydratedAtomValue, "value" | "resultPromise"> & {
  readonly value: Schema.Json;
};

export const dehydrateAtom = <A>(atom: Atom.Atom<A>, value: A): DehydratedAtomValue => {
  if (!Atom.isSerializable(atom)) {
    throw new Error("Cannot dehydrate an atom without serialization metadata");
  }

  return {
    "~effect/reactivity/DehydratedAtom": true,
    key: atom[Atom.SerializableTypeId].key,
    value: Schema.decodeUnknownSync(Schema.Json)(atom[Atom.SerializableTypeId].encode(value)),
    dehydratedAt: Date.now(),
  };
};
