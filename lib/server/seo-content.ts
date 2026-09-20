import"server-only";
import{cache}from"react";
import{supabaseRest}from"./supabase-rest";
export type PublishedSeoContent={id:string;title:string;slug:string;excerpt:string|null;body:string|null;seo_title:string|null;meta_description:string|null;canonical_url:string|null;featured_image_url:string|null;author_name:string|null;author_role:string|null;author_bio:string|null;cluster:string;primary_keyword:string|null;tags:string[];cta_type:string;published_at:string|null;updated_at:string;recommended_internal_links:string[]};
const fields="id,title,slug,excerpt,body,seo_title,meta_description,canonical_url,featured_image_url,author_name,author_role,author_bio,cluster,primary_keyword,tags,cta_type,published_at,updated_at,recommended_internal_links";
export const getPublishedSeoContent=cache(async(slug:string)=>{const{data}=await supabaseRest<PublishedSeoContent[]>(`seo_content_items?slug=eq.${encodeURIComponent(slug.slice(0,140))}&status=eq.published&indexable=eq.true&select=${fields}&limit=1`);return data[0]||null});
export const listPublishedSeoContent=cache(async(limit=1000)=>{const{data}=await supabaseRest<PublishedSeoContent[]>(`seo_content_items?status=eq.published&indexable=eq.true&select=${fields}&order=published_at.desc.nullslast&limit=${Math.min(limit,1000)}`);return data});
