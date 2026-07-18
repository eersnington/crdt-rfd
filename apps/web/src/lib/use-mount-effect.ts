import { useEffect, type EffectCallback } from "react";

export const useMountEffect = (effect: EffectCallback) => {
  useEffect(effect, []);
};
