export type UnameKeyMap = Map<string, Value>;

export class Value {
  constructor(
    public comments: string[],
    public value: any = null,
  ) {}
}
