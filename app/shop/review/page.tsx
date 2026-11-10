import type {Metadata} from "next";
import CatalogueBrowser from "../catalogue/catalogue-browser";
export const metadata:Metadata={title:"Private catalogue review | BidScope",robots:{index:false,follow:false}};
export default function Page(){return <CatalogueBrowser/>;}
