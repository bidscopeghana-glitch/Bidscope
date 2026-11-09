import type {Metadata} from "next";
import CatalogueBrowser from "./catalogue-browser";
export const metadata:Metadata={title:"Product catalogue | BidScope private preview",robots:{index:false,follow:false}};
export default function CataloguePage(){return <CatalogueBrowser/>;}
