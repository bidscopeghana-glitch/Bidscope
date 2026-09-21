import {Suspense} from "react";
import {ProcurementShell} from "@/components/procurement/buyer-workspace";
import "../customer/customer.css";
import "./procurement.css";
import "@/components/chat/tender-chat.css";
export const metadata={title:"Procurement workspace | BidScope",robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <Suspense fallback={<div className="cc-loading">Opening procurement workspace…</div>}><ProcurementShell>{children}</ProcurementShell></Suspense>}
