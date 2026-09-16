import {OutreachProspectDetail} from "@/components/admin/outreach-prospect-detail";
export default async function Page({params}:{params:Promise<{id:string}>}){return <OutreachProspectDetail id={(await params).id}/>}
