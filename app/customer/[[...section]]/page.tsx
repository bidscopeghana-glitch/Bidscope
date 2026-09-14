import { notFound } from "next/navigation";
import { CustomerPage } from "@/components/customer/pages";
export const metadata={title:"Your command centre | BidScope",robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{section?:string[]}>}){
  const {section=[]}=await params;
  const allowed=["home","discover","recommended","saved","following","recent","bids","pipeline","documents","deadlines","buyers","intelligence","awards","ai","alerts","profile","readiness","billing","notifications","help","settings","opportunity"];
  if(!allowed.includes(section[0]||"home")||section.length>2)notFound();
  return <CustomerPage section={section[0]||"home"} identifier={section[1]}/>;
}
