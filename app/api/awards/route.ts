import { apiErrorResponse } from "@/lib/server/api-error";
import { pagination } from "@/lib/server/query";
import { requireUser } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const incoming = new URL(request.url).searchParams;
    const { page, pageSize, offset } = pagination(incoming);
    const endpoint = new URL(process.env.WORLD_BANK_AWARDS_API_URL || "https://datacatalogapi.worldbank.org/dexapps/fone/api/apiservice?datasetId=DS00005&resourceId=RS00005&type=json");
    endpoint.searchParams.set("top", String(pageSize)); endpoint.searchParams.set("skip", String(offset)); endpoint.searchParams.set("filter", "borrower_country='Ghana'");
    const response = await fetch(endpoint, { headers: { Accept: "application/json", "User-Agent": "BidScopeGhana/1.0" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`World Bank awards source returned HTTP ${response.status}`);
    const body = await response.json() as { count?:number|string; data?:Array<Record<string,unknown>> };
    const text=(record:Record<string,unknown>,key:string)=>typeof record[key]==="string"?String(record[key]).trim():record[key]==null?null:String(record[key]);
    const number=(record:Record<string,unknown>,key:string)=>{const value=Number(record[key]);return Number.isFinite(value)?value:null;};
    const data=(body.data||[]).map(record=>{const projectId=text(record,"project_id");const contract=text(record,"wb_contract_number")||text(record,"borrower_contract_reference_number")||crypto.randomUUID();const supplier=text(record,"supplier");return {id:`world-bank:${contract}`,title:text(record,"contract_description")||"World Bank-financed contract award",reference_number:text(record,"borrower_contract_reference_number")||contract,award_date:text(record,"contract_signing_date"),currency:"USD",award_value:number(record,"supplier_contract_amount_usd"),procurement_method:text(record,"procurement_method"),source_url:projectId?`https://projects.worldbank.org/en/projects-operations/project-detail/${encodeURIComponent(projectId)}`:"https://financesone.worldbank.org/contract-awards-in-investment-project-financing/DS00005",buyer:{id:projectId||contract,name:text(record,"project_name")||"World Bank-financed Ghana project",slug:projectId||contract},suppliers:supplier?[{id:`${contract}:supplier`,supplier_name:supplier,supplier_registration_number:text(record,"supplier_id"),country_code:text(record,"supplier_country_code"),awarded_value:number(record,"supplier_contract_amount_usd"),is_joint_venture:false}]:[]};});
    return Response.json({ data, pagination: { page, pageSize, total: Number(body.count || data.length) } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
