import {z} from "zod";
import {deliveryDestinations} from "./retail-pricing.ts";

const identifier=z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);
export const checkoutReviewInput=z.object({
 requestKey:z.string().uuid(),
 destination:z.string().refine(value=>deliveryDestinations.some(([code])=>code===value),"Choose a supported destination to check."),
 origin:z.enum(["CN","US","GB","DE","FR"]),
 lines:z.array(z.object({productId:identifier,variantId:identifier,quantity:z.number().int().min(1).max(999),service:z.string().min(1).max(200).optional()}).strict()).min(1).max(5),
}).strict().superRefine((input,context)=>{
 const ids=input.lines.map(line=>JSON.stringify([line.productId,line.variantId]));
 if(new Set(ids).size!==ids.length)context.addIssue({code:z.ZodIssueCode.custom,message:"Combine duplicate product options before requesting a review."});
});
export type CheckoutReviewInput=z.infer<typeof checkoutReviewInput>;
export type ReviewLine={productId:string;variantId:string;name:string;variantName:string;quantity:number;unitUsdMinor:number;merchandiseUsdMinor:number;service:string;estimate:string;freightUsdMinor:number;providerTaxUsdMinor:number|null;clearanceUsdMinor:number|null;postageUsdMinor:number;checkedAt:string};
export type CheckoutReview={
 id:string;mode:"private_review";status:"held";destination:string;origin:string;createdAt:string;expiresAt:string;
 lines:ReviewLine[];merchandiseUsdMinor:number;postageUsdMinor:number;knownSubtotalUsdMinor:number;knownSubtotalGhsMinor:number;
 fxAsOf:string;fxValidUntil:string;paymentFeeGhsMinor:null;destinationDutyGhsMinor:null;payableGhsMinor:null;
 blockers:string[];checkoutEnabled:false;
};
export type ReviewRecord={id:string;status:"checking"|"held"|"failed";createdAt:string;review:CheckoutReview|null;error:string|null};
