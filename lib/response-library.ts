export const ANSWER_CATEGORIES=["Company profile","Quality assurance","Health and safety","Environmental management","Data protection","Business continuity","Safeguarding","Supply chain","Delivery capability","ESG","Equality","Anti-bribery","Experience","Mobilisation","Risk management","Project methodology"] as const;
export type LibraryAnswer={id:string;title:string;category:string;tags:string[];draft_content:string;revision:number;approved_version:number|null;review_date:string|null;archived:boolean;updated_at:string};
export type AnswerVersion={id:string;answer_id:string;version:number;title:string;content:string;approved_at:string;review_date:string|null};
export function answerNeedsReview(reviewDate:string|null,now=new Date()) {return Boolean(reviewDate&&reviewDate<now.toISOString().slice(0,10));}
export function approvedAnswerOptions(answers:LibraryAnswer[],versions:AnswerVersion[],now=new Date()) {
 const approved=new Map(versions.map(version=>[`${version.answer_id}:${version.version}`,version]));
 return answers.filter(answer=>!answer.archived&&answer.approved_version!==null).flatMap(answer=>{
  const version=approved.get(`${answer.id}:${answer.approved_version}`);
  return version?[{answer,version,needsReview:answerNeedsReview(version.review_date,now)}]:[];
 });
}
