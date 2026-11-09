import {z} from "zod";
import {requireLocalCommerceSetup,cjConnection} from "@/lib/server/commerce/cj-connection";
import {createCjCatalogueInspector} from "@/lib/server/commerce/cj-catalogue";
import {openCatalogue} from "@/lib/server/commerce/catalogue-store";
import {openCheckoutReviews} from "@/lib/server/commerce/checkout-review-store";
import {getDailyFx} from "@/lib/server/commerce/daily-fx";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";

const api=createCjCatalogueInspector(()=>cjConnection.token());
function store(){return openCheckoutReviews({fx:getDailyFx,check:(line,input)=>api.checkoutLine(line.productId,line.variantId,input.origin,line.quantity,input.destination),imported(id){const catalogue=openCatalogue();try{return Boolean(catalogue.find(id));}finally{catalogue.close();}}});}
const headers={"Cache-Control":"no-store"};
export async function GET(request:Request){try{requireLocalCommerceSetup(request);const id=new URL(request.url).searchParams.get("id"),ledger=store();try{if(id){z.string().uuid().parse(id);const record=ledger.get(id);if(!record)throw new ApiError(404,"Saved review not found.","review_not_found");return Response.json({record},{headers});}return Response.json({records:ledger.list(),liveCheckout:false},{headers});}finally{ledger.close();}}catch(error){return apiErrorResponse(error);}}
export async function POST(request:Request){try{requireLocalCommerceSetup(request);if(Number(request.headers.get("content-length")||0)>8192)throw new ApiError(413,"Review request is too large.");const text=await request.text();if(text.length>8192)throw new ApiError(413,"Review request is too large.");const ledger=store();try{let input:unknown;try{input=JSON.parse(text);}catch{throw new ApiError(400,"The review request must contain valid JSON.");}return Response.json(await ledger.prepare(input),{headers});}finally{ledger.close();}}catch(error){return apiErrorResponse(error);}}
