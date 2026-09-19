import { MeetingRoom } from "@/components/meetings/meeting-room";
export const metadata={title:"BidScope Meet",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{meetingId:string}>}){const{meetingId}=await params;return <MeetingRoom meetingId={meetingId}/>;}
