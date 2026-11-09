import {z} from "zod";
import {deliveryDestinations} from "./retail-pricing.ts";
const id=z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);
export const shopQuoteInput=z.object({
 origin:z.enum(["CN","US","GB","DE","FR"]),
 address:z.object({name:z.string().trim().min(2).max(100),phone:z.string().trim().regex(/^\+?[0-9 ()-]{7,25}$/),countryCode:z.string().refine(value=>deliveryDestinations.some(([code])=>code===value)),province:z.string().trim().max(100),city:z.string().trim().min(1).max(100),postalCode:z.string().trim().max(30),address:z.string().trim().min(5).max(200)}).strict(),
 lines:z.array(z.object({productId:id,variantId:id,quantity:z.number().int().min(1).max(99)}).strict()).min(1).max(5),
 acknowledgeImportCharges:z.literal(true)
}).strict().superRefine((input,context)=>{const keys=input.lines.map(line=>line.productId+":"+line.variantId);if(new Set(keys).size!==keys.length)context.addIssue({code:z.ZodIssueCode.custom,message:"Combine duplicate options in your bag."});});
export type ShopQuoteInput=z.infer<typeof shopQuoteInput>;
export const checkoutCostPolicy={customerProcessingFeeMinor:0,importChargesPolicy:"customer_pays_excluded",copy:"BidScope covers payment processing fees. Import duties, taxes and carrier charges not included in this quote are payable by you to the relevant authority or carrier."} as const;
