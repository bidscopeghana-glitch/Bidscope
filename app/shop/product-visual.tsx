"use client";
import {useId} from "react";
import Image from "next/image";
import type {Product} from "@/lib/commerce/core";
export function ProductPicture({product}:{product:Product}){
 return product.image?<Image className="shop-photo" src={product.image} alt={product.name} width={600} height={480} unoptimized/>:<ProductVisual kind={product.art}/>;
}
export function ProductVisual({kind}:{kind:"lamp"|"bag"|"bottle"|"chair"}){
 const id=useId().replaceAll(":","");
 const fill=(name:string)=>"url(#"+id+name+")";
 return <svg viewBox="0 0 360 280" role="img" aria-label={"Original sample "+kind+" product rendering"}>
 <defs>
 <linearGradient id={id+"metal"} x1="0" x2="1"><stop stopColor="#183c30"/><stop offset=".3" stopColor="#527565"/><stop offset=".55" stopColor="#305445"/><stop offset="1" stopColor="#102e24"/></linearGradient>
 <linearGradient id={id+"gold"} x1="0" x2=".8" y2="1"><stop stopColor="#f7d68a"/><stop offset=".45" stopColor="#d8af62"/><stop offset="1" stopColor="#a77c35"/></linearGradient>
 <linearGradient id={id+"canvas"} x1="0" x2="1" y2=".5"><stop stopColor="#d8c3a0"/><stop offset=".5" stopColor="#efe0bf"/><stop offset="1" stopColor="#bc9f75"/></linearGradient>
 <linearGradient id={id+"sage"} x1="0" x2="1"><stop stopColor="#59776a"/><stop offset=".23" stopColor="#a7bdb0"/><stop offset=".5" stopColor="#bbcec1"/><stop offset=".8" stopColor="#849f8e"/><stop offset="1" stopColor="#526f60"/></linearGradient>
 <linearGradient id={id+"seat"} x1="0" y1="0" x2=".7" y2="1"><stop stopColor="#c5d0bf"/><stop offset=".55" stopColor="#9fae96"/><stop offset="1" stopColor="#768972"/></linearGradient>
 <radialGradient id={id+"shadow"}><stop stopColor="#173526" stopOpacity=".24"/><stop offset="1" stopColor="#173526" stopOpacity="0"/></radialGradient>
 <pattern id={id+"weave"} width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 1H4M1 0V4" stroke="#98754d" strokeWidth=".35" opacity=".25"/></pattern>
 </defs>
 <ellipse cx="180" cy="247" rx="119" ry="18" fill={fill("shadow")}/>
 {kind==="lamp"?<g><ellipse cx="165" cy="235" rx="58" ry="10" fill="#153c2a"/><ellipse cx="165" cy="231" rx="58" ry="9" fill={fill("metal")}/><path d="M165 230V119Q165 67 220 70" stroke={fill("metal")} strokeWidth="9" fill="none"/><path d="M168 227V120Q168 75 219 74" stroke="#9fb0a0" strokeOpacity=".35" strokeWidth="2" fill="none"/><path d="M195 79Q206 45 235 56Q256 64 268 109L189 109Z" fill={fill("gold")}/><ellipse cx="228" cy="109" rx="40" ry="5" fill="#987334"/><ellipse cx="228" cy="108" rx="35" ry="3" fill="#fff2be"/><path d="M211 62Q197 81 197 99" stroke="#fff2c2" strokeWidth="2" opacity=".4" fill="none"/></g>
 :kind==="bag"?<g><path d="M109 101L94 228Q174 256 264 230L250 100Z" fill="#b29770"/><path d="M110 100L108 225Q174 245 249 226L250 100Z" fill={fill("canvas")}/><path d="M110 100L108 225Q174 245 249 226L250 100Z" fill={fill("weave")}/><path d="M109 101Q179 113 250 100" stroke="#b0956c" strokeWidth="5" fill="none"/><path d="M137 127V74Q138 40 159 39Q186 38 187 75V128M175 127V73Q176 38 200 39Q224 42 224 76V127" stroke="#a1845c" strokeWidth="8" fill="none"/><path d="M137 126V74Q138 44 158 43M175 126V73Q178 43 198 43" stroke="#d9c29b" strokeWidth="2" fill="none"/><path d="M119 115L117 216M240 114L239 217" stroke="#a08761" strokeWidth="1" strokeDasharray="2 3"/><rect x="158" y="166" width="43" height="23" rx="3" fill="#294e39"/><path d="M165 173H194M165 178H187" stroke="#d7bd81" strokeWidth="1" opacity=".75"/></g>
 :kind==="bottle"?<g><path d="M147 53Q181 46 214 53V78H147Z" fill={fill("metal")}/><ellipse cx="180" cy="53" rx="34" ry="6" fill="#264a3b"/><path d="M145 76Q133 83 133 106V220Q135 242 180 244Q227 241 227 220V106Q226 83 215 76Z" fill={fill("sage")}/><ellipse cx="180" cy="79" rx="34" ry="5" fill="#4d6f5b"/><path d="M146 103V216" stroke="#e9f0e8" strokeWidth="5" opacity=".4" strokeLinecap="round"/><path d="M135 225Q180 237 225 225" stroke="#536f5c" strokeWidth="2" fill="none" opacity=".4"/><rect x="165" y="160" width="30" height="2" rx="1" fill="#567760"/><path d="M164 167H194" stroke="#567760" strokeWidth="1"/></g>
 :<g><path d="M117 155L105 242M242 155L254 242M126 161L137 238M230 161L222 238" stroke={fill("metal")} strokeWidth="8" strokeLinecap="round"/><path d="M118 70Q180 38 241 70L235 155H124Z" fill={fill("seat")}/><path d="M126 76Q180 50 232 76" stroke="#dfe5d7" strokeWidth="2" fill="none" opacity=".5"/><path d="M119 155Q178 142 241 156L252 171Q181 190 108 171Z" fill="#728a6d"/><path d="M119 151Q180 141 241 151L249 163Q180 179 112 163Z" fill={fill("seat")}/><path d="M128 79L134 144M232 80L226 144" stroke="#82947a" strokeWidth="1" strokeDasharray="2 2"/><path d="M108 171Q180 189 252 171" stroke="#2e5039" strokeWidth="3" fill="none"/></g>}
 </svg>;
}
