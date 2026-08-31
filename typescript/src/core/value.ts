export type ValueMap = Map<symbol, Value>;
export type UnameKeyMap = Map<string, Value>;

export class Value {
  constructor(
    public value: any,
    public origin: string,
    public sym = Symbol(),
    public comments: string[] = [],
  ) {}
}
