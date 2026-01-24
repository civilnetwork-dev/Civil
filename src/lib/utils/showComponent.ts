import { v4 as uuidv4 } from "uuid";

export interface ComponentInstance<TProps = unknown> {
  id: string;
  Component: any;
  props: TProps;
}

export function showComponent<TProps>(
  Component: any,
  props: TProps,
): ComponentInstance<TProps> {
  return {
    id: uuidv4(),
    Component,
    props,
  };
}
