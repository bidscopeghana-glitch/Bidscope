import { ProcurementFooter,ProcurementHeader } from "@/components/procurement/site-shell";
import { SupplierReadiness } from "./supplier-readiness";
export const metadata={title:"Supplier Readiness | BidScope Ghana"};
export default function Page(){return <><ProcurementHeader/><main><SupplierReadiness/></main><ProcurementFooter/></>}
