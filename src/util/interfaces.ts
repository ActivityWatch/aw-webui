export interface IEvent {
  timestamp: string;
  duration: number;
  data: Record<string, any>;
}

export interface IBucket {
  id: string;
  hostname: string;
  device_id: string;
  type: string;
  data: Record<string, any>;
  metadata?: { start: Date; end: Date };
  last_updated?: Date;
  first_seen?: Date;
  created?: Date;
}
