import { apiErrorResponse } from "@/lib/server/api-error";
import { requireCronOrInternalSecret } from "@/lib/server/auth";
import { processPendingDeliveries } from "@/lib/server/notifications";
import { generateMeetingReminders,generateWatchedTenderClosingAlerts } from "@/lib/server/scheduled-sms-alerts";

export const dynamic="force-dynamic";
export const maxDuration=60;

async function run(){
  const[meetingReminders,watchedClosing]=await Promise.all([generateMeetingReminders(),generateWatchedTenderClosingAlerts()]);
  const deliveries=await processPendingDeliveries(100);
  return{meetingReminders,watchedClosing,deliveries};
}

export async function POST(request:Request){
  try{requireCronOrInternalSecret(request);return Response.json(await run());}
  catch(error){return apiErrorResponse(error);}
}

export async function GET(request:Request){return POST(request);}
