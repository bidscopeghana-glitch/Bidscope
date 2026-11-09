import {requireUser} from "@/lib/server/auth";
import {ApiError,apiErrorResponse} from "@/lib/server/api-error";
import {submitOrderRequest} from "@/lib/server/commerce/order-requests";
export async function POST(request:Request){try{
 const {user}=await requireUser(request);
 if(request.headers.get("origin")!==new URL(request.url).origin||request.headers.get("content-type")?.split(";")[0]!=="application/json")throw new ApiError(403,"Same-origin JSON is required.");
 if(Number(request.headers.get("content-length")||0)>20000)throw new ApiError(413,"Request too large.");
 const id=await submitOrderRequest(user.id,await request.json());
 return Response.json({id,message:"Your request was received for review. This does not confirm a cancellation, return or refund."},{headers:{"Cache-Control":"private, no-store"}});
 }catch(error){return apiErrorResponse(error);}}
