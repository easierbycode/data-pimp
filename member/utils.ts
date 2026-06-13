import { createDefine } from "fresh";

export interface State {
  /** Auth-related state populated by middleware (stubbed for now). */
  user?: {
    id: string;
    email: string;
    name: string;
    initials: string;
  };
}

export const define = createDefine<State>();
