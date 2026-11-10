import {apiErrorResponse} from "@/lib/server/api-error";
import {supabaseRest,supabaseRpc} from "@/lib/server/supabase-rest";
import {getDailyFx} from "@/lib/server/commerce/daily-fx";
import {storefrontQuery,storefrontProduct} from "@/lib/server/commerce/storefront";
export async function GET(request:Request){try{
 if(process.env.BIDSCOPE_SHOP_PUBLIC_CATALOGUE!=="1")return Response.json({items:[],total:0,page:1,pageSize:24,categories:[],checkoutEnabled:false,availability:"preparing"},{headers:{"Cache-Control":"no-store"}});
 const {input,path}=storefrontQuery(Object.fromEntries(new URL(request.url).searchParams));
 const [{data,response},fx,categories]=await Promise.all([supabaseRest<unknown[]>(path,{count:"exact"}),getDailyFx().catch(()=>null),supabaseRpc<{category:string}[]>("bidscope_shop_publication_categories",{})]);
 const items=data.map(row=>storefrontProduct(row,fx));
 return Response.json({items,total:Number(response.headers.get("content-range")?.split("/")[1]||0),page:input.page,pageSize:24,categories:categories.data.map(c=>c.category),checkoutEnabled:false,availability:"catalogue"},{headers:{"Cache-Control":"no-store"}});
 }catch(error){const response=apiErrorResponse(error);response.headers.set("Cache-Control","no-store");return response;}}
