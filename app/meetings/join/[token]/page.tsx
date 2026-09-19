import { MeetingRoom } from "@/components/meetings/meeting-room";
export const metadata={title:"Join BidScope Meet",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{token:string}>}){const{token}=await params;return <MeetingRoom guestToken={token}/>;}
