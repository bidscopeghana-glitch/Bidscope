import {ApiError} from "../api-error";

export type SendEmailInput={from:string;to:string;replyTo?:string|null;subject:string;html:string;text?:string|null;headers?:Record<string,string>;idempotencyKey:string};
export type SendEmailResult={providerMessageId:string;status:"queued"};
export interface EmailProvider{name:string;sendEmail(input:SendEmailInput):Promise<SendEmailResult>;getDeliveryStatus(providerMessageId:string):Promise<string|null>}

class ResendProvider implements EmailProvider{
  name="resend";
  private key(){const value=process.env.RESEND_API_KEY;if(!value)throw new ApiError(503,"The email provider is not configured.","email_provider_unavailable");return value;}
  async sendEmail(input:SendEmailInput){const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${this.key()}`,"Content-Type":"application/json","Idempotency-Key":input.idempotencyKey},body:JSON.stringify({from:input.from,to:[input.to],reply_to:input.replyTo||undefined,subject:input.subject,html:input.html,text:input.text||undefined,headers:input.headers})});const data=await response.json() as{id?:string;message?:string};if(!response.ok||!data.id)throw new ApiError(response.status===429?429:503,data.message||"The outreach email could not be queued.","email_send_failed");return{providerMessageId:data.id,status:"queued" as const};}
  async getDeliveryStatus(providerMessageId:string){const response=await fetch(`https://api.resend.com/emails/${encodeURIComponent(providerMessageId)}`,{headers:{Authorization:`Bearer ${this.key()}`},cache:"no-store"});if(!response.ok)return null;const data=await response.json() as{last_event?:string};return data.last_event||null;}
}
export function getEmailProvider(name=process.env.OUTREACH_EMAIL_PROVIDER||"resend"):EmailProvider{if(name!=="resend")throw new ApiError(503,"The selected outreach email provider is not supported.","email_provider_unavailable");return new ResendProvider();}
