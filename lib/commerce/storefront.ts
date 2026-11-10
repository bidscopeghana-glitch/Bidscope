import {z} from "zod";
import {cjPreviewImage} from "./cj-preview.ts";

export const storefrontId=z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);
export const publicationInput=z.object({
 productId:storefrontId,description:z.string().trim().min(40).max(6000).refine(v=>!/[<>]/.test(v),"Use plain text, not HTML."),
 rightsEvidence:z.string().trim().min(20).max(3000),mediaEvidence:z.string().trim().min(20).max(3000),
 reviewExpiresAt:z.string().datetime(),origin:z.string().regex(/^[A-Z]{2}$/),
}).strict();
export const publicationAction=z.discriminatedUnion("action",[
 publicationInput.extend({action:z.literal("approve")}),
 z.object({action:z.literal("retire"),productId:storefrontId,reason:z.string().trim().min(10).max(1000)}).strict(),
]);
export const publicProductSchema=z.object({
 id:storefrontId,name:z.string(),description:z.string(),category:z.string(),image:z.string().refine(v=>Boolean(cjPreviewImage(v))),origin:z.string(),
 checkedAt:z.string().datetime(),variants:z.array(z.object({id:storefrontId,name:z.string(),retailUsdMinor:z.number().int().nonnegative(),priceGhsMinor:z.number().int().nonnegative().nullable()})),
 priceGhsMinor:z.number().int().nonnegative().nullable(),fxAsOf:z.string().nullable(),fxValidUntil:z.string().nullable(),
});
export type PublicProduct=z.infer<typeof publicProductSchema>;
