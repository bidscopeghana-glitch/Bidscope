export type Job={id:string;kind:"sync"|"tracking"|"supplier_order"|"refund";attempts:number;status:"pending"|"processing"|"done"|"exception";availableAt:number;leaseUntil:number|null;error:string|null};
export function claimJob(job:Job,now:number):Job|null{
 if(job.status!=="pending"||job.availableAt>now||job.attempts>=5)return null;
 return {...job,status:"processing",attempts:job.attempts+1,leaseUntil:now+60000};
}
export function failJob(job:Job,reason:string,now:number):Job{
 // Reads may retry; ambiguous writes require reconciliation before an admin retry.
 const retry=["sync","tracking"].includes(job.kind)&&job.attempts<5;
 return {...job,status:retry?"pending":"exception",availableAt:now+Math.min(3600000,30000*2**job.attempts),leaseUntil:null,error:reason.slice(0,300)};
}
export function recoverExpiredLease(job:Job,now:number):Job{
 return job.status==="processing"&&job.leaseUntil!==null&&job.leaseUntil<=now?failJob(job,"Worker lease expired; reconcile provider state.",now):job;
}
