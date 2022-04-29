export interface IEvent {
  timestamp: string;
  duration: number;
  data: Record<string, any>;
}

export interface IBucket {
  id: string;
  hostname: string;
  type: string;
  data: Record<string, any>;
}
