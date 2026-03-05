const c='classList';
const a='darkmode';
const n='darkMode';
const p=document;
const l=localStorage;
const _t=()=>{
    const b=p.body;
    const w=p.getElementById('wrapper');
    const d=b[c].contains(a);
    if(d){
        b[c].remove(a);
        w[c].remove(a);
        l.setItem(n,'0');
    }else{
        b[c].add(a);
        w[c].add(a);
        l.setItem(n,'1');
    }
};
p.addEventListener('DOMContentLoaded',()=>{
    const s=l.getItem(n);
    const b=p.body;
    const w=p.getElementById('wrapper');
    if(s!=='0'){
        b[c].add(a);
        w[c].add(a);
        l.setItem(n,'1');
    }else{
        b[c].remove(a);
        w[c].remove(a);
    }
});
window.toggleDarkMode=_t;
