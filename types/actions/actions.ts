
export enum Action {
  GetTransactions = 'get_transactions',
}

export type Payloads = {
  [Action.GetTransactions]: GetTransactionsPayload;
}

export interface GetTransactionsPayload {
  limit?: number;
  filters?: Record<string, any>;
}
