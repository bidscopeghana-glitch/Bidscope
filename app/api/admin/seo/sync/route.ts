import{apiErrorResponse}from"@/lib/server/api-error";import{requireSuperAdmin}from"@/lib/server/auth";import{syncSearchConsole}from"@/lib/server/search-console";
export const maxDuration=60;export async function POST(request:Request){try{const{user}=await requireSuperAdmin(request);return Response.json({data:await syncSearchConsole(user.id)})}catch(error){return apiErrorResponse(error)}}
