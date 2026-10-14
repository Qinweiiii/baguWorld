import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'hot100.md');
const outputPath = path.join(root, 'hot100.html');

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

function inlineMarkdown(value) {
  const code = [];
  let text = escapeHtml(value).replace(/`([^`]+)`/g, (_, body) => {
    code.push(`<code>${body}</code>`);
    return `\u0000${code.length - 1}\u0000`;
  });
  text = text
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\u0000(\d+)\u0000/g, (_, index) => code[Number(index)]);
  return text;
}

function slugify(text, index) {
  const slug = text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-|-$/g, '');
  return slug || `section-${index}`;
}

function renderMarkdown(markdown) {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const html = [];
  const toc = [];
  let paragraph = [];
  let code = [];
  let codeLanguage = '';
  let inCode = false;
  let listType = '';
  let headingIndex = 0;

  const closeParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = '';
    }
  };
  const closeCode = () => {
    html.push(`<pre data-language="${escapeHtml(codeLanguage || 'text')}"><code>${escapeHtml(code.join('\n'))}</code></pre>`);
    code = [];
    codeLanguage = '';
    inCode = false;
  };

  for (const line of lines) {
    const fence = line.match(/^\s*```\s*([^\s]*)/);
    if (fence) {
      closeParagraph();
      closeList();
      if (inCode) closeCode();
      else {
        inCode = true;
        codeLanguage = fence[1] || '';
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeParagraph();
      closeList();
      headingIndex += 1;
      const level = heading[1].length;
      const title = heading[2].trim();
      const id = slugify(title, headingIndex);
      html.push(`<h${level} id="${id}">${inlineMarkdown(title)}<a class="anchor" href="#${id}" aria-label="链接到本节">#</a></h${level}>`);
      toc.push({ level, title, id });
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      closeParagraph();
      const nextType = unordered ? 'ul' : 'ol';
      if (listType !== nextType) {
        closeList();
        listType = nextType;
        html.push(`<${listType}>`);
      }
      html.push(`<li>${inlineMarkdown((unordered || ordered)[1])}</li>`);
      continue;
    }

    if (/^\s*$/.test(line)) {
      closeParagraph();
      closeList();
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) {
      closeParagraph();
      closeList();
      html.push('<hr>');
      continue;
    }
    paragraph.push(line.trim());
  }
  closeParagraph();
  closeList();
  if (inCode) closeCode();
  return { body: html.join('\n'), toc };
}

const source = fs.readFileSync(sourcePath, 'utf8');
const { body, toc } = renderMarkdown(source);
const categories = toc.filter((item) => item.level === 1);
const problems = toc.filter((item) => item.level === 2).length;
const tocLinks = categories.map((item) => `<a href="#${item.id}">${inlineMarkdown(item.title)}</a>`).join('\n');
const tocOptions = categories.map((item) => `<option value="#${item.id}">${escapeHtml(item.title)}</option>`).join('\n');

const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark">
<title>算法远征 · Hot 100 题解笔记</title>
<style>
:root{box-sizing:border-box;--bg:#101412;--panel:#171d19;--ink:#edf1e8;--dim:#a8b0a5;--line:#34423a;--green:#8fcf9a;--cyan:#79c9d7;--code:#0b0e0c}
*,*::before,*::after{box-sizing:inherit}
html{scroll-behavior:smooth;scroll-padding-top:24px}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.78 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
a{color:var(--cyan)}
.layout{display:grid;grid-template-columns:250px minmax(0,820px);gap:42px;width:min(1160px,100%);margin:0 auto;padding:38px 24px 72px}
.side{position:sticky;top:24px;align-self:start;max-height:calc(100vh - 48px);overflow:auto;padding-right:16px}
.eyebrow{color:var(--green);font-size:12px;font-weight:800;letter-spacing:.12em}
.side h1{font-size:24px;line-height:1.2;margin:8px 0 6px}
.meta{color:var(--dim);font-size:13px;margin-bottom:18px}
#search{width:100%;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);padding:10px 11px;font:inherit;margin-bottom:14px}
#search:focus{outline:2px solid var(--green);outline-offset:2px}
nav{display:grid;gap:3px}
nav a{color:var(--dim);text-decoration:none;padding:5px 7px;border-left:2px solid transparent;font-size:14px}
nav a:hover{color:var(--ink);border-color:var(--green)}
.mobile-nav{display:none}
.hero{border-bottom:1px solid var(--line);padding-bottom:26px;margin-bottom:34px}
.hero h2{font-size:clamp(34px,7vw,58px);line-height:1.08;margin:8px 0 12px;letter-spacing:0}
.hero p{max-width:650px;color:var(--dim);font-size:17px;margin:0}
article h1{font-size:32px;line-height:1.2;margin:58px 0 22px;padding-top:20px;border-top:1px solid var(--line);color:var(--green);letter-spacing:0}
article h2{font-size:23px;line-height:1.35;margin:42px 0 14px;letter-spacing:0}
article h3{font-size:18px;margin:30px 0 10px;letter-spacing:0}
.anchor{opacity:0;margin-left:8px;text-decoration:none;font-size:.7em;color:var(--dim)}
h1:hover .anchor,h2:hover .anchor,h3:hover .anchor{opacity:1}
p{margin:10px 0 16px}
ul,ol{padding-left:24px;margin:10px 0 18px}
li{margin:6px 0}
strong{color:#fff}
code{font-family:"SFMono-Regular",Consolas,"Liberation Mono",monospace;font-size:.9em}
p code,li code{background:#202921;border:1px solid var(--line);border-radius:4px;padding:2px 5px;color:#b9e6c1}
pre{position:relative;overflow:auto;background:var(--code);border:1px solid var(--line);border-radius:7px;padding:38px 17px 17px;margin:16px 0 24px;line-height:1.6;-webkit-overflow-scrolling:touch}
pre::before{content:attr(data-language);position:absolute;top:9px;left:14px;color:var(--dim);font:700 11px/1 system-ui;text-transform:uppercase}
pre code{font-size:13px;white-space:pre}
img{display:block;max-width:100%;height:auto;margin:20px auto;border:1px solid var(--line);border-radius:6px;background:#fff}
hr{border:0;border-top:1px solid var(--line);margin:34px 0}
.empty{display:none;color:var(--dim);padding:30px 0}
@media(max-width:820px){
  .layout{display:block;padding:22px 17px 56px}.side{position:static;max-height:none;padding:0 0 22px}.side nav{display:none}
  .side h1{font-size:21px}.mobile-nav{display:grid;grid-template-columns:1fr;gap:8px}.mobile-nav select{width:100%;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:6px;padding:10px;font:inherit}
  .hero h2{font-size:38px}article h1{font-size:27px;margin-top:46px}article h2{font-size:21px;margin-top:36px}
  pre{margin-left:-5px;margin-right:-5px;padding-left:13px;padding-right:13px}.anchor{display:none}
}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
</style>
</head>
<body>
<div class="layout">
  <aside class="side">
    <div class="eyebrow">ALGORITHM EXPEDITION</div>
    <h1>Hot 100 题解笔记</h1>
    <div class="meta">${categories.length} 个专题 · ${problems} 道题目</div>
    <input id="search" type="search" placeholder="搜索题目或知识点" aria-label="搜索题目或知识点">
    <nav aria-label="专题目录">${tocLinks}</nav>
    <div class="mobile-nav"><select id="sectionSelect" aria-label="跳转专题"><option value="">跳转到专题</option>${tocOptions}</select></div>
  </aside>
  <main>
    <header class="hero">
      <div class="eyebrow">第 10 篇章</div>
      <h2>算法远征</h2>
      <p>从哈希、双指针到动态规划，集中整理 Hot 100 高频题目的思路、代码与易错点。</p>
    </header>
    <div class="empty" id="empty">没有找到匹配内容，请换个关键词。</div>
    <article id="content">${body}</article>
  </main>
</div>
<script>
const search=document.getElementById('search');
const content=document.getElementById('content');
const empty=document.getElementById('empty');
const original=content.innerHTML;
search.addEventListener('input',()=>{
  const query=search.value.trim().toLocaleLowerCase();
  if(!query){content.innerHTML=original;empty.style.display='none';return}
  const source=document.createElement('div');source.innerHTML=original;
  const headings=[...source.querySelectorAll('h2')];
  const matches=[];
  for(const heading of headings){
    const block=[heading];let node=heading.nextElementSibling;
    while(node&&!['H1','H2'].includes(node.tagName)){block.push(node);node=node.nextElementSibling}
    if(block.some(item=>item.textContent.toLocaleLowerCase().includes(query)))matches.push(...block.map(item=>item.outerHTML));
  }
  content.innerHTML=matches.join('');empty.style.display=matches.length?'none':'block';
});
document.getElementById('sectionSelect').addEventListener('change',event=>{if(event.target.value)location.hash=event.target.value});
</script>
</body>
</html>`;

fs.writeFileSync(outputPath, page);
console.log(`Generated ${path.relative(root, outputPath)} from ${path.relative(root, sourcePath)}`);
