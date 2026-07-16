import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { getAuth } from "./auth.ts";

export const getSession = createServerFn({ method: "GET" }).handler(() =>
  getAuth().api.getSession({ headers: getRequestHeaders() }),
);
