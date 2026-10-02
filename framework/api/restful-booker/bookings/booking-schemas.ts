import { z } from 'zod';

export const BookingSchema = z
  .object({
    firstname: z.string(),
    lastname: z.string(),
    totalprice: z.number().int().nonnegative(),
    depositpaid: z.boolean(),
    bookingdates: z.object({ checkin: z.iso.date(), checkout: z.iso.date() }).strict(),
    additionalneeds: z.string().optional(),
  })
  .strict();

export const CreatedBookingSchema = z
  .object({ bookingid: z.number().int().positive(), booking: BookingSchema })
  .strict();

export const BookingIdsSchema = z.array(
  z.object({ bookingid: z.number().int().positive() }).strict(),
);

export type Booking = z.output<typeof BookingSchema>;
export type CreatedBooking = z.output<typeof CreatedBookingSchema>;
export type BookingPatch = Partial<Omit<Booking, 'bookingdates'>> & {
  readonly bookingdates?: Booking['bookingdates'];
};

/** Search filters supported by `GET /booking`. */
export interface BookingQuery {
  readonly firstname?: string;
  readonly lastname?: string;
}
