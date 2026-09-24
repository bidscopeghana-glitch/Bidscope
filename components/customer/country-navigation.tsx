"use client";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {ChevronDown,MapPin} from "lucide-react";
import {useData} from "./data";

type Country={country:string;filter:string;code:string;count:number};

export function CountryNavigation({variant="customer",close}:{variant?:"customer"|"persistent";close?:()=>void}){
  const countries=useData<{data:Country[]}>("/api/customer?resource=countries"),params=useSearchParams();
  const selected=params.get("country");
  return <details className={`${variant==="customer"?"cc":"pws"}-countries`} open={Boolean(selected)}>
    <summary><span>Countries</span><ChevronDown size={14}/></summary>
    <div className={`${variant==="customer"?"cc":"pws"}-country-list`}>
      {countries.loading?<span className="country-loading">Loading countries…</span>:countries.error?<span className="country-loading">Countries unavailable</span>:countries.data?.data.map(item=><Link key={`${item.code}-${item.country}`} href={`/customer/discover?country=${encodeURIComponent(item.filter)}&countryName=${encodeURIComponent(item.country)}`} aria-current={selected===item.filter?"page":undefined} onClick={close}><MapPin size={13}/><span>{item.country}</span><small>{item.count}</small></Link>)}
    </div>
  </details>;
}
