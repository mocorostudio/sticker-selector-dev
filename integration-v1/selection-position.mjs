// Keep the same image at the same viewport offset, including layout changes.
// Short-lived observers are cancelled by the next operation or intentional scrolling.
let release=()=>{};
export function preserveCardPosition(list,change,itemId){
 release();
 const cards=[...list.children];
 const card=cards.find(x=>x.dataset.itemId===itemId)||cards.find(x=>x.getBoundingClientRect().bottom>0);
 if(!card)return change();
 const id=card.dataset.itemId,top=card.getBoundingClientRect().top;
 let stopped=false,observer,timer,frame;
 const find=()=>[...list.children].find(x=>x.dataset.itemId===id);
 const restore=()=>{if(stopped)return;const current=find();if(!current)return;const delta=current.getBoundingClientRect().top-top;if(Math.abs(delta)>.5)window.scrollBy({top:delta,left:0,behavior:'instant'});};
 const stop=()=>{stopped=true;observer?.disconnect();clearTimeout(timer);cancelAnimationFrame(frame);for(const type of ['touchstart','wheel','pointerdown','keydown'])window.removeEventListener(type,stop,true);};
 release=stop;
 const result=change();restore();
 frame=requestAnimationFrame(restore);
 observer=new ResizeObserver(restore);observer.observe(list);for(const x of list.children)observer.observe(x);
 for(const type of ['touchstart','wheel','pointerdown','keydown'])window.addEventListener(type,stop,{capture:true,passive:true});
 timer=setTimeout(stop,1200);
 return result;
}
