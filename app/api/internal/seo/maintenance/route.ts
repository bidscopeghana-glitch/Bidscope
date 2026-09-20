import{apiErrorResponse}from"@/lib/server/api-error";import{requireCronOrInternalSecret}from"@/lib/server/auth";import{runSeoMaintenance}from"@/lib/server/seo-maintenance";
export const dynamic="force-dynamic";export const maxDuration=300;
export async function GET(request:Request){try{requireCronOrInternalSecret(request);return Response.json(await runSeoMaintenance())}catch(error){return apiErrorResponse(error)}}
export async function POST(request:Request){return GET(request)}
