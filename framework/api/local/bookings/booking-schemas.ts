import { z } from 'zod';

export const LocalBookingSchema = z
  .object({
    id: z.number().int().positive(),
    userId: z.uuid(),
    roomId: z.number().int().positive(),
    guestName: z.string(),
    checkin: z.iso.date(),
    checkout: z.iso.date(),
  })
  .strict();

export const LocalBookingListSchema = z.array(LocalBookingSchema);

export type LocalBooking = z.output<typeof LocalBookingSchema>;
export type NewLocalBooking = Omit<LocalBooking, 'id' | 'userId'>;
