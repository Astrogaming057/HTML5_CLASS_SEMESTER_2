const c='classList';
const a='darkmode';
const p=document;
const l=localStorage;
const _t=()=>{
    const b=p.body;
    const w=p.getElementById('wrapper');
    const d=b[c].contains(a);
    if(d){
        b[c].remove(a);
        w[c].remove(a);
        l.setItem(a,'0');
    }else{
        b[c].add(a);
        w[c].add(a);
        l.setItem(a,'1');
    }
};
p.addEventListener('DOMContentLoaded',()=>{
    const s=l.getItem(a);
    const b=p.body;
    const w=p.getElementById('wrapper');
    if(s!=='0'){
        b[c].add(a);
        w[c].add(a);
        l.setItem(a,'1');
    }else{
        b[c].remove(a);
        w[c].remove(a);
    }
});
window.toggleDarkMode=_t;
console.log('ready...')