// ---- DB ----
const DB = {
  get(t){try{return JSON.parse(localStorage.getItem('ds_'+t)||'[]')}catch{return[]}},
  set(t,d){localStorage.setItem('ds_'+t,JSON.stringify(d))},
  forM(t,mid){return this.get(t).filter(r=>r.merchant_id===mid)},
  insert(t,rec,mid){
    const all=this.get(t);
    const r={...rec,id:'id_'+Date.now()+'_'+Math.random().toString(36).substr(2,6),merchant_id:mid,created_at:new Date().toISOString()};
    all.push(r);this.set(t,all);return r;
  },
  update(t,id,ups,mid){
    const all=this.get(t),i=all.findIndex(r=>r.id===id&&r.merchant_id===mid);
    if(i===-1)return false;
    all[i]={...all[i],...ups,updated_at:new Date().toISOString()};
    this.set(t,all);return true;
  },
  delete(t,id,mid){
    const all=this.get(t),f=all.filter(r=>!(r.id===id&&r.merchant_id===mid));
    this.set(t,f);return f.length<all.length;
  },
  _hash(s){let h=0;for(let i=0;i<s.length;i++){h=Math.imul(31,h)+s.charCodeAt(i)|0;}return 'h'+Math.abs(h).toString(36)},
  newMid(){return 'merchant_'+Date.now()+'_'+Math.random().toString(36).substr(2,8)}
};


// ---- AUTH ----
const Auth = {
  register({nom_commerce,proprietaire,telephone,ville,password,type}){
    const ms=DB.get('merchants');
    if(ms.find(m=>m.telephone===telephone))throw new Error('Ce téléphone est déjà utilisé.');
    const mid=DB.newMid(),exp=new Date();exp.setDate(exp.getDate()+30);
    const m={id:mid,nom_commerce,proprietaire,telephone,ville,type:type||'boutique',
      password:DB._hash(password),licence:'active',licence_expiry:exp.toISOString(),actif:true,created_at:new Date().toISOString()};
    ms.push(m);DB.set('merchants',ms);
    const cfgs=DB.get('configs');
    cfgs.push({merchant_id:mid,couleur_theme:'#E8730C',devise:'FCFA',
      message_accueil:'Bienvenue chez '+nom_commerce+' !',
      wa_message:'Merci {nom} pour votre achat de {total} chez {commerce} 🙏 Revenez bientôt !',
      pin:'',created_at:new Date().toISOString()});
    DB.set('configs',cfgs);
    return m;
  },
  login(telephone,password){
    const m=DB.get('merchants').find(m=>m.telephone===telephone&&m.password===DB._hash(password));
    if(!m)throw new Error('Numéro ou mot de passe incorrect.');
    if(!m.actif)throw new Error('Compte désactivé.');
    sessionStorage.setItem('ds_m',JSON.stringify(m));return m;
  },
  current(){try{return JSON.parse(sessionStorage.getItem('ds_m')||'null')}catch{return null}},
  refresh(ups){
    const c=this.current();if(!c)return;
    const u={...c,...ups};sessionStorage.setItem('ds_m',JSON.stringify(u));
    const ms=DB.get('merchants'),i=ms.findIndex(m=>m.id===c.id);
    if(i!==-1){ms[i]={...ms[i],...ups};DB.set('merchants',ms);}
    return u;
  },
  logout(){sessionStorage.removeItem('ds_m')}
};

