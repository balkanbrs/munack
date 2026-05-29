import { z } from "zod";
import React from "react";

export const schema = z.object({
  name: z.string()
});

export function App() {
  return React.createElement("div", null, "Munack sample");
}

