import { type LinkedWesl, type LinkParams, link } from "wesl";

/** api sketch for link() with proposed features */
export interface Link2Params extends LinkParams {
  overrides?: Record<string, any>;
}

export function link2(params: Link2Params): Promise<LinkedWesl> {
  return link(params);
}
