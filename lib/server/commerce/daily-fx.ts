import {z} from "zod";
const schema=z.object({result:z.literal("success"),base_code:z.literal("USD"),time_last_update_unix:z.number().int().positive(),time_next_update_unix:z.number().int().positive(),rates:z.object({USD:z.literal(1),GHS:z.number().positive().max(1000)})});
export type DailyFx={rateMicros:number;asOf:string;validUntil:string};
export function dailyFxSnapshot(raw:unknown,now=Date.now()):DailyFx{
 const data=schema.parse(raw),asOf=data.time_last_update_unix*1000,next=data.time_next_update_unix*1000;
 if(asOf>now+300000||now-asOf>36*3600000||next<=asOf||next-asOf>36*3600000)throw Error("A current daily exchange rate is unavailable.");
 return {rateMicros:Math.round(data.rates.GHS*1000000),asOf:new Date(asOf).toISOString(),validUntil:new Date(Math.min(next+12*3600000,asOf+36*3600000)).toISOString()};
}
export function ghsMinor(usdMinor:number,fx:DailyFx,now=Date.now()){
 if(!Number.isSafeInteger(usdMinor)||usdMinor<0||!Number.isSafeInteger(fx.rateMicros)||fx.rateMicros<=0||!Number.isFinite(Date.parse(fx.validUntil))||Date.parse(fx.validUntil)<=now)throw Error("Invalid or expired currency conversion.");
 const result=(BigInt(usdMinor)*BigInt(fx.rateMicros)+BigInt(999999))/BigInt(1000000);
 if(result>BigInt(Number.MAX_SAFE_INTEGER))throw Error("Converted price exceeds the supported amount.");return Number(result);
}
export async function getDailyFx(transport:typeof fetch=fetch){
 const r=await transport("https://open.er-api.com/v6/latest/USD",{next:{revalidate:3600},redirect:"error",signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error("Daily currency conversion is temporarily unavailable.");return dailyFxSnapshot(await r.json());
}
