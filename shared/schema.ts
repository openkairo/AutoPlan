export interface Stop {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  paymentMethod: string;
  deliveryDate: string | null;
  lat: number | null;
  lng: number | null;
  notes: string | null;
  solarModule: string | null;
  solarQuantity: number | null;
  completed: boolean;
  sortOrder: number;
}

export type InsertStop = Omit<Stop, "id" | "sortOrder">;
