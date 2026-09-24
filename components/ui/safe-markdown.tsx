import type {ReactNode} from "react";

function safeHref(value:string){
  try{
    const url=new URL(value);
    return url.protocol==="https:"||url.protocol==="http:"?url.href:null;
  }catch{return null;}
}

function inlineMarkdown(value:string):ReactNode[]{
  const pattern=/(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*([^*]+)\*)/g;
  const nodes:ReactNode[]=[];
  let cursor=0;
  for(const match of value.matchAll(pattern)){
    const index=match.index??0;
    if(index>cursor)nodes.push(value.slice(cursor,index));
    if(match[2])nodes.push(<strong key={`${index}-strong`}>{match[2]}</strong>);
    else if(match[3])nodes.push(<code key={`${index}-code`}>{match[3]}</code>);
    else if(match[4]){
      const href=safeHref(match[5]);
      nodes.push(href?<a key={`${index}-link`} href={href} target="_blank" rel="noreferrer">{match[4]}</a>:match[4]);
    }else if(match[6])nodes.push(<em key={`${index}-em`}>{match[6]}</em>);
    cursor=index+match[0].length;
  }
  if(cursor<value.length)nodes.push(value.slice(cursor));
  return nodes;
}

export function SafeMarkdown({content,className=""}:{content:string;className?:string}){
  const lines=content.replace(/\r\n?/g,"\n").split("\n");
  const blocks:ReactNode[]=[];
  for(let index=0;index<lines.length;){
    const line=lines[index].trim();
    if(!line){index++;continue;}
    if(/^-{3,}$/.test(line)){blocks.push(<hr key={index}/>);index++;continue;}
    const next=lines[index+1]?.trim()||"";
    if(/^\|.*\|$/.test(line)&&/^\|(?:\s*:?-{3,}:?\s*\|)+$/.test(next)){
      const cells=(row:string)=>row.slice(1,-1).split("|").map(cell=>cell.trim());
      const headers=cells(line);index+=2;const rows:string[][]=[];
      while(index<lines.length&&/^\|.*\|$/.test(lines[index].trim())){rows.push(cells(lines[index].trim()));index++;}
      blocks.push(<div className="markdown-table-wrap" key={`table-${index}`}><table><thead><tr>{headers.map((cell,column)=><th key={column}>{inlineMarkdown(cell)}</th>)}</tr></thead><tbody>{rows.map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,column)=><td key={column}>{inlineMarkdown(cell)}</td>)}</tr>)}</tbody></table></div>);continue;
    }
    const heading=line.match(/^(#{1,3})\s+(.+)$/);
    if(heading){
      const text=inlineMarkdown(heading[2]);
      blocks.push(heading[1].length===1?<h2 key={index}>{text}</h2>:<h3 key={index}>{text}</h3>);
      index++;continue;
    }
    if(/^[-*]\s+/.test(line)){
      const items:ReactNode[]=[];
      while(index<lines.length&&/^[-*]\s+/.test(lines[index].trim())){
        items.push(<li key={index}>{inlineMarkdown(lines[index].trim().replace(/^[-*]\s+/,""))}</li>);index++;
      }
      blocks.push(<ul key={`ul-${index}`}>{items}</ul>);continue;
    }
    if(/^\d+\.\s+/.test(line)){
      const items:ReactNode[]=[];
      while(index<lines.length&&/^\d+\.\s+/.test(lines[index].trim())){
        items.push(<li key={index}>{inlineMarkdown(lines[index].trim().replace(/^\d+\.\s+/,""))}</li>);index++;
      }
      blocks.push(<ol key={`ol-${index}`}>{items}</ol>);continue;
    }
    blocks.push(<p key={index}>{inlineMarkdown(line)}</p>);index++;
  }
  return <div className={className}>{blocks}</div>;
}
