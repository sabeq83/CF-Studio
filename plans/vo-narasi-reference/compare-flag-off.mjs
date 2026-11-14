// Pembanding prompt flag-off: rilis lama vs kode sekarang (v2.45.1 wajib 0 beda).
// Cara pakai (dari root repo):
//   OLD=$(mktemp -d) && git archive 7e4d5b4 lib templates package.json | tar -x -C $OLD && ln -s "$PWD/node_modules" $OLD/node_modules
//   DISABLE_AUTO_MIGRATIONS=true node plans/vo-narasi-reference/compare-flag-off.mjs $OLD "$PWD"
// Output yang diharapkan: "pillar 0 / 192", "multiplier 0 / 16", "recipe 0 / 4".
const OLD=process.argv[2], NEW=process.argv[3];
const o=await import(OLD+'/lib/prompts.js'), n=await import(NEW+'/lib/prompts.js');
const oc=await import(OLD+'/lib/content-format-constants.js'), nc=await import(NEW+'/lib/content-format-constants.js');
const prod={product_name:'Bawang Hitam Tunggal',brand:'Garlibee',category:'Herbal',description:'Bawang hitam fermentasi',usp:'Fermentasi 90 hari',price:85000,key_benefits:['manis','lembut'],ingredients:'bawang lanang',cara_pakai:'Makan 2 siung pagi',takaran_label:'2 siung',fakta_produksi:'Fermentasi 3 bulan'};
const camps=[];
for (const mode of ['Storytelling','Edukasi','Tips/Tutorial','Problem-Solution'])
 for (const lang of ['id-ID','en-US'])
  for (const clips of [3,4,8])
   for (const bridging of [0,1])
    camps.push({campaign_name:'X',content_pillar:'peredam suara',custom_hook:'Hook?',visual_action_guideline:'POV',narrative_mode:mode,visual_style:'Cinematic',words_per_clip:'17-19 kata',clip_duration:8,target_clips_count:clips,aspect_ratio:'9:16',target_language:lang,face_visibility:'Faceless',is_bridging_active:bridging,finishing_template:'none',product_mode:bridging?'soft':'none',_rowPayload:{content_payload:{search_answer:'a',takeaways:[{point:'p',anchor:'3 mm'}]}}});
let diff=0,tot=0;
for (const c of camps) for (const p of [null,prod]) for (const kb of [[],[{name:'KB_FOOD',content:'KB1 text'},{name:'KB_HOOK',content:'hook kb'}]]) {
  tot++; const a=o.buildOrganicPillarPrompt(kb,{...c},p,{brand_name:'B',brand_voice:'santai'},null), b=n.buildOrganicPillarPrompt(kb,{...c},p,{brand_name:'B',brand_voice:'santai'},null);
  if(a!==b){diff++; if(diff<=2){let i=0;while(a[i]===b[i])i++;console.log('PILLAR DIFF',c.narrative_mode,c.target_language,c.target_clips_count,!!p,'\nOLD:',JSON.stringify(a.slice(i-80,i+200)),'\nNEW:',JSON.stringify(b.slice(i-80,i+200)));}}
}
console.log('pillar',diff,'/',tot);
const sb={storyboard:[{clip:1,narration_transcript:'Ambil 1 sdm madu',visual:'x'},{clip:2,narration_transcript:'Campur',visual:'y'},{clip:3,narration_transcript:'Oles',visual:'z'}],ingredients:['madu','pati jagung']};
diff=0;tot=0;
for (const pd of [null,prod]) for (const br of [null,{enabled:true,at_clip:2}]) for (const lang of ['id-ID','en-US']) for (const ri of [0,1]) {
 tot++; const args=[sb,pd,{style:'warm',target_language:lang},br,null,{tts:true,target_language:lang},ri,'aff'];
 let a,b; try{a=o.buildMultiplierPhase2Prompt(...args)}catch(e){a='ERR '+e.message} try{b=n.buildMultiplierPhase2Prompt(...args)}catch(e){b='ERR '+e.message}
 if(a!==b){diff++; if(diff<=2){let i=0;while(a[i]===b[i])i++;console.log('MUL DIFF\nOLD:',JSON.stringify(a.slice(i-80,i+200)),'\nNEW:',JSON.stringify(b.slice(i-80,i+200)));}}
}
console.log('multiplier',diff,'/',tot);
diff=0;tot=0;
for (const act of [true,false]) for (const lang of ['id-ID','en-US']) { tot++; if(oc.getRecipeMandateSection(act,lang)!==nc.getRecipeMandateSection(act,lang)) {diff++; console.log('RECIPE DIFF',act,lang)} }
console.log('recipe',diff,'/',tot);
