import type {Metadata} from "next";

export const SITE_NAME="BidScope";
export const SITE_URL=(process.env.NEXT_PUBLIC_SITE_URL||"https://www.bidscopeghana.com").replace(/\/$/,"");
export const DEFAULT_OG_IMAGE="/brand/social/bidscope-og.png";

export function absoluteUrl(path="/"){
  if(/^https:\/\//i.test(path))return path;
  return `${SITE_URL}${path.startsWith("/")?path:`/${path}`}`;
}

export function publicMetadata(input:{title:string;description:string;path:string;image?:string;type?:"website"|"article";noindex?:boolean}):Metadata{
  const canonical=absoluteUrl(input.path);
  const image=absoluteUrl(input.image||DEFAULT_OG_IMAGE);
  return{
    title:input.title,
    description:input.description,
    alternates:{canonical},
    robots:input.noindex?{index:false,follow:true}:{index:true,follow:true},
    openGraph:{type:input.type||"website",url:canonical,siteName:SITE_NAME,title:input.title,description:input.description,images:[{url:image,width:1200,height:630,alt:input.title}]},
    twitter:{card:"summary_large_image",title:input.title,description:input.description,images:[image]},
  };
}

export function safeJsonLd(value:unknown){return JSON.stringify(value).replace(/</g,"\\u003c");}

