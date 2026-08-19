const API="https://recherche-entreprises.api.gouv.fr/search";
const S={page:1,perPage:20,total:0,results:[],favorites:load("fce_favorites",[]),history:load("fce_history",[]),compare:load("fce_compare",[]),saved:load("fce_saved",[]),sort:"relevance",theme:localStorage.getItem("fce_theme")||"light"};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
document.documentElement.dataset.theme=S.theme;
function updateThemeButton(){const b=$("#themeToggle");if(b)b.textContent=S.theme==="dark"?"☀":"☾"}
updateThemeButton();
$("#themeToggle")?.addEventListener("click",()=>{S.theme=S.theme==="dark"?"light":"dark";localStorage.setItem("fce_theme",S.theme);document.documentElement.dataset.theme=S.theme;updateThemeButton()});

function load(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function save(k,v){localStorage.setItem(k,JSON.stringify(v))}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function toast(m){const e=$("#toast");e.textContent=m;e.classList.remove("hidden");setTimeout(()=>e.classList.add("hidden"),2200)}
function route(n){["home","search","detail","favorites","compare","history"].forEach(v=>$(`#${v}View`)?.classList.toggle("hidden",v!==n));if(n==="favorites")renderFavorites();if(n==="compare")renderCompare();if(n==="history")renderHistory();window.scrollTo({top:0,behavior:"smooth"})}
$$("[data-route]").forEach(b=>b.onclick=()=>route(b.dataset.route));
$$("[data-query]").forEach(b=>b.onclick=()=>{route("search");$("#queryInput").value=b.dataset.query;search(1)});
$("#randomDemoBtn").onclick=()=>{const q=["La Poste","Renault","Université de Strasbourg","API Restauration"][Math.floor(Math.random()*4)];route("search");$("#queryInput").value=q;search(1)};
$("#searchForm").onsubmit=e=>{e.preventDefault();search(1)};
$("#clearSearchBtn").onclick=()=>{$("#searchForm").reset();$("#pageSizeFilter").value="20";S.results=[];S.total=0;$("#resultsGrid").innerHTML="";$("#resultCount").textContent="0 résultat";$("#resultsTitle").textContent="Entreprises";$("#pagination").classList.add("hidden");showState("Saisis un nom, un SIREN ou un mot-clé.")};
$("#prevPage").onclick=()=>{if(S.page>1)search(S.page-1)};$("#nextPage").onclick=()=>{if(S.page<Math.ceil(S.total/S.perPage))search(S.page+1)};
$("#clearFavoritesBtn").onclick=()=>{S.favorites=[];save("fce_favorites",S.favorites);renderFavorites();toast("Favoris supprimés.")};
$("#clearHistoryBtn").onclick=()=>{S.history=[];save("fce_history",S.history);renderHistory()};$("#sortSelect").onchange=()=>{sortResults();renderResults();renderStats()};$("#saveSearchBtn").onclick=saveCurrentSearch;$("#exportJsonBtn").onclick=exportJson;$("#exportCsvBtn").onclick=exportCsv;


function syncUrl(){
 const p=new URLSearchParams();
 const q=$("#queryInput").value.trim(),cp=$("#postalCodeFilter").value.trim(),city=$("#cityFilter").value.trim(),st=$("#statusFilter").value;
 if(q)p.set("q",q);if(cp)p.set("cp",cp);if(city)p.set("city",city);if(st)p.set("status",st);
 if(S.page>1)p.set("page",String(S.page));if(S.perPage!==20)p.set("size",String(S.perPage));
 const url=p.toString()?`${location.pathname}?${p.toString()}`:location.pathname;
 history.replaceState({}, "", url);
}
function restoreFromUrl(){
 const p=new URLSearchParams(location.search);
 if(p.get("q"))$("#queryInput").value=p.get("q");
 if(p.get("cp"))$("#postalCodeFilter").value=p.get("cp");
 if(p.get("city"))$("#cityFilter").value=p.get("city");
 if(p.get("status"))$("#statusFilter").value=p.get("status");
 if(p.get("size"))$("#pageSizeFilter").value=p.get("size");
 return {hasQuery:!!p.get("q"),page:Number(p.get("page")||1)};
}
function getVisibleCompanies(){return S.results.map(norm)}
function sortResults(){
 const mode=$("#sortSelect")?.value||"relevance";S.sort=mode;
 if(mode==="relevance")return;
 const arr=[...S.results];
 const n=x=>norm(x);
 arr.sort((a,b)=>{
  const A=n(a),B=n(b);
  if(mode==="name-asc")return A.name.localeCompare(B.name,"fr");
  if(mode==="name-desc")return B.name.localeCompare(A.name,"fr");
  if(mode==="creation-newest")return String(B.creation).localeCompare(String(A.creation));
  if(mode==="creation-oldest")return String(A.creation).localeCompare(String(B.creation));
  if(mode==="status")return String(A.status).localeCompare(String(B.status));
  return 0;
 });
 S.results=arr;
}
function renderStats(){
 const root=$("#statsPanel"),companies=getVisibleCompanies();
 if(!companies.length){root.classList.add("hidden");root.innerHTML="";return}
 const active=companies.filter(c=>c.status==="A").length;
 const closed=companies.length-active;
 const cities=new Set(companies.map(c=>c.city).filter(Boolean)).size;
 const withWorkforce=companies.filter(c=>c.workforce&&c.workforce!=="Non renseigné").length;
 root.innerHTML=`<article><span class="muted">Affichées</span><strong>${companies.length}</strong></article>
 <article><span class="muted">En activité</span><strong>${active}</strong></article>
 <article><span class="muted">Cessées</span><strong>${closed}</strong></article>
 <article><span class="muted">Communes distinctes</span><strong>${cities}</strong><small class="muted">${withWorkforce} avec effectif renseigné</small></article>`;
 root.classList.remove("hidden");
}
function downloadFile(name,mime,content){
 const blob=new Blob([content],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
function exportJson(){downloadFile("companies-results.json","application/json;charset=utf-8",JSON.stringify(getVisibleCompanies(),null,2))}
function csvEscape(v){const s=String(v??"");return `"${s.replaceAll('"','""')}"`}
function exportCsv(){
 const rows=[["SIREN","Nom","Statut","Activité","Ville","Code postal","Création","SIRET siège"]];
 getVisibleCompanies().forEach(c=>rows.push([c.siren,c.name,c.status,c.activityLabel,c.city,c.postalCode,c.creation,c.siret]));
 downloadFile("companies-results.csv","text/csv;charset=utf-8","\uFEFF"+rows.map(r=>r.map(csvEscape).join(";")).join("\n"));
}
function saveCurrentSearch(){
 const q=$("#queryInput").value.trim();if(!q)return toast("Aucune recherche à sauvegarder.");
 const name=prompt("Nom de la recherche sauvegardée :",q);if(!name)return;
 const entry={id:Date.now(),name,query:q,postalCode:$("#postalCodeFilter").value.trim(),city:$("#cityFilter").value.trim(),status:$("#statusFilter").value,pageSize:+$("#pageSizeFilter").value||20};
 S.saved.unshift(entry);S.saved=S.saved.slice(0,12);save("fce_saved",S.saved);toast("Recherche sauvegardée.");
}

async function search(page){
 const q=$("#queryInput").value.trim();if(!q)return showState("Entre un terme de recherche.");
 S.page=page;S.perPage=+$("#pageSizeFilter").value||20;
 const p=new URLSearchParams({q,page:String(page),per_page:String(S.perPage)});
 const cp=$("#postalCodeFilter").value.trim(),city=$("#cityFilter").value.trim(),st=$("#statusFilter").value;
 if(cp)p.set("code_postal",cp);if(city)p.set("commune",city);if(st)p.set("etat_administratif",st);
 showState("Recherche en cours…");$("#resultsGrid").innerHTML="";$("#pagination").classList.add("hidden");
 try{
  const r=await fetch(`${API}?${p}`);if(!r.ok)throw new Error();
  const d=await r.json();S.results=d.results||[];S.total=d.total_results??S.results.length;syncUrl();sortResults();
  addHistory({query:q,postalCode:cp,city,status:st,at:new Date().toISOString()});
  $("#resultsTitle").textContent=`Résultats pour “${q}”`;$("#resultCount").textContent=`${S.total} résultat(s)`;$("#searchState").classList.add("hidden");renderResults();renderPagination();renderStats();
 }catch{$("#resultCount").textContent="Erreur API";showState("Impossible de joindre l'API. Réessaie dans quelques instants.")}
}
function norm(x){const s=x.siege||{};return{siren:x.siren||"—",name:x.nom_complet||x.nom_raison_sociale||x.nom||"Entreprise sans nom",activity:x.activite_principale||s.activite_principale||"Non renseignée",activityLabel:x.libelle_activite_principale||"Activité non renseignée",status:x.etat_administratif||s.etat_administratif||"",creation:x.date_creation||"Non renseignée",legal:x.nature_juridique||"Non renseignée",category:x.categorie_entreprise||"Non renseignée",workforce:x.tranche_effectif_salarie||"Non renseigné",siret:s.siret||"Non renseigné",address:s.adresse||[s.numero_voie,s.type_voie,s.libelle_voie,s.code_postal,s.libelle_commune].filter(Boolean).join(" ")||"Adresse non renseignée",postalCode:s.code_postal||"",city:s.libelle_commune||"",matchingEstablishments:x.matching_etablissements||x.etablissements||[]}}
function renderResults(){const root=$("#resultsGrid");if(!S.results.length)return showState("Aucune entreprise ne correspond à cette recherche.");root.innerHTML=S.results.map(raw=>{const c=norm(raw),fav=S.favorites.some(x=>x.siren===c.siren);return`<article class="company" data-testid="company-card-${c.siren}"><div class="company-top"><div><span class="status ${c.status==="A"?"active":"closed"}">${c.status==="A"?"En activité":"Cessée"}</span><h3>${esc(c.name)}</h3><p class="muted">SIREN ${c.siren}</p></div><button class="fav ${fav?"active":""}" data-fav="${c.siren}">♥</button></div><div class="company-meta"><div class="meta-line"><b>Activité :</b> ${esc(c.activityLabel)}</div><div class="meta-line"><b>Siège :</b> ${esc(c.city||c.address)}</div><div class="meta-line"><b>Création :</b> ${esc(c.creation)}</div></div><div class="company-footer"><button class="button secondary" data-compare="${c.siren}">Comparer</button><button class="button" data-detail="${c.siren}">Voir la fiche</button></div></article>`}).join("");root.querySelectorAll("[data-detail]").forEach(b=>b.onclick=()=>openDetail(b.dataset.detail));root.querySelectorAll("[data-fav]").forEach(b=>b.onclick=()=>toggleFav(b.dataset.fav));root.querySelectorAll("[data-compare]").forEach(b=>b.onclick=()=>addCompare(b.dataset.compare))}
function renderPagination(){const max=Math.max(1,Math.ceil(S.total/S.perPage));$("#pageLabel").textContent=`Page ${S.page} / ${max}`;$("#prevPage").disabled=S.page<=1;$("#nextPage").disabled=S.page>=max;$("#pagination").classList.toggle("hidden",S.total<=S.perPage)}
function current(siren){const r=S.results.find(x=>String(x.siren)===String(siren));return r?norm(r):null}
async function openDetail(siren){let c=current(siren)||S.favorites.find(x=>x.siren===siren);if(!c){try{const r=await fetch(`${API}?q=${encodeURIComponent(siren)}&per_page=1`),d=await r.json();if(d.results?.[0])c=norm(d.results[0])}catch{}}if(!c)return toast("Entreprise introuvable.");route("detail");renderDetail(c)}
function renderDetail(c){const fav=S.favorites.some(x=>x.siren===c.siren);$("#detailRoot").innerHTML=`<section class="detail-hero"><article class="panel detail-main"><div class="detail-heading"><div><p class="eyebrow">ENTREPRISE</p><h1 class="detail-title">${esc(c.name)}</h1><p class="muted">${esc(c.activityLabel)}</p></div><button id="detailFav" class="fav ${fav?"active":""}">♥</button></div><div class="actions"><span class="status ${c.status==="A"?"active":"closed"}">${c.status==="A"?"En activité":"Cessée"}</span><span class="pill">SIREN ${c.siren}</span></div></article><article class="panel detail-side"><p class="eyebrow">IDENTIFIANTS</p><dl class="definition"><div><dt>SIREN</dt><dd>${c.siren}</dd></div><div><dt>SIRET du siège</dt><dd>${esc(c.siret)}</dd></div><div><dt>Code activité</dt><dd>${esc(c.activity)}</dd></div></dl></article></section><section class="detail-grid"><article class="panel detail-section"><p class="eyebrow">SIÈGE SOCIAL</p><h3>${esc(c.city||"Localisation")}</h3><p>${esc(c.address)}</p><p class="muted">${esc(c.postalCode)}</p></article><article class="panel detail-section"><p class="eyebrow">STRUCTURE</p><dl class="definition"><div><dt>Catégorie</dt><dd>${esc(c.category)}</dd></div><div><dt>Nature juridique</dt><dd>${esc(c.legal)}</dd></div><div><dt>Effectif</dt><dd>${esc(c.workforce)}</dd></div></dl></article><article class="panel detail-section"><p class="eyebrow">CRÉATION</p><h3>${esc(c.creation)}</h3></article><article class="panel detail-section"><p class="eyebrow">ACTIONS</p><div class="actions"><button id="detailCompare" class="button secondary">Comparer</button><button id="copySiren" class="button">Copier le SIREN</button></div></article><article class="panel detail-section" style="grid-column:1/-1"><p class="eyebrow">ÉTABLISSEMENTS</p><div class="establishments">${(c.matchingEstablishments||[]).length?(c.matchingEstablishments||[]).map(e=>`<div class="establishment"><b>${esc(e.siret||"SIRET non renseigné")}</b><p>${esc(e.adresse||e.libelle_commune||"Adresse non renseignée")}</p><span class="status ${e.etat_administratif==="A"?"active":"closed"}">${e.etat_administratif==="A"?"En activité":"Cessé"}</span></div>`).join(""):"<p class=\"muted\">Aucun établissement correspondant renvoyé pour cette recherche.</p>"}</div></article></section>`;$("#detailFav").onclick=()=>toggleFav(c.siren);$("#detailCompare").onclick=()=>addCompare(c.siren);$("#copySiren").onclick=async()=>{await navigator.clipboard.writeText(c.siren);toast("SIREN copié.")}}
function toggleFav(siren){const old=S.favorites.find(x=>x.siren===siren);if(old){S.favorites=S.favorites.filter(x=>x.siren!==siren);toast("Retiré des favoris.")}else{const c=current(siren);if(!c)return;S.favorites.push(c);toast("Ajouté aux favoris.")}save("fce_favorites",S.favorites);if(!$("#searchView").classList.contains("hidden"))renderResults();if(!$("#favoritesView").classList.contains("hidden"))renderFavorites()}
function renderFavorites(){const root=$("#favoritesGrid");if(!S.favorites.length){root.innerHTML='<div class="state">Aucun favori pour le moment.</div>';return}root.innerHTML=S.favorites.map(c=>`<article class="company"><div class="company-top"><div><h3>${esc(c.name)}</h3><p class="muted">SIREN ${c.siren}</p></div><button class="fav active" data-remove="${c.siren}">♥</button></div><div class="company-meta"><div class="meta-line">${esc(c.activityLabel)}</div><div class="meta-line">${esc(c.city||c.address)}</div></div><div class="company-footer"><button class="button secondary" data-compare="${c.siren}">Comparer</button><button class="button" data-open="${c.siren}">Voir la fiche</button></div></article>`).join("");root.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>toggleFav(b.dataset.remove));root.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openDetail(b.dataset.open));root.querySelectorAll("[data-compare]").forEach(b=>b.onclick=()=>addCompare(b.dataset.compare))}
function addHistory(e){S.history=[e,...S.history.filter(x=>x.query!==e.query||x.postalCode!==e.postalCode||x.city!==e.city)].slice(0,12);save("fce_history",S.history)}
function renderHistory(){const root=$("#historyList"),savedRoot=$("#savedSearchesList");if(!S.history.length){root.innerHTML='<div class="state">Aucune recherche enregistrée.</div>';return}root.innerHTML=S.history.map((x,i)=>`<article><div><p><b>${esc(x.query)}</b></p><small class="muted">${esc([x.postalCode,x.city].filter(Boolean).join(" · ")||"Sans filtre géographique")}</small></div><button class="button secondary" data-h="${i}">Relancer</button></article>`).join("");root.querySelectorAll("[data-h]").forEach(b=>b.onclick=()=>{const x=S.history[+b.dataset.h];route("search");$("#queryInput").value=x.query||"";$("#postalCodeFilter").value=x.postalCode||"";$("#cityFilter").value=x.city||"";$("#statusFilter").value=x.status||"";search(1)});savedRoot.innerHTML=S.saved.length?S.saved.map((x,i)=>`<article><div><p class="saved-name">${esc(x.name)}</p><small class="muted">${esc(x.query)}</small></div><div class="actions"><button class="button secondary" data-saved="${i}">Lancer</button><button class="button secondary" data-del-saved="${x.id}">×</button></div></article>`).join(""):`<div class="state">Aucune recherche sauvegardée.</div>`;savedRoot.querySelectorAll("[data-saved]").forEach(b=>b.onclick=()=>{const x=S.saved[+b.dataset.saved];route("search");$("#queryInput").value=x.query||"";$("#postalCodeFilter").value=x.postalCode||"";$("#cityFilter").value=x.city||"";$("#statusFilter").value=x.status||"";$("#pageSizeFilter").value=String(x.pageSize||20);search(1)});savedRoot.querySelectorAll("[data-del-saved]").forEach(b=>b.onclick=()=>{S.saved=S.saved.filter(x=>String(x.id)!==b.dataset.delSaved);save("fce_saved",S.saved);renderHistory()})}
function addCompare(siren){const c=current(siren)||S.favorites.find(x=>x.siren===siren);if(!c)return toast("Recherche d'abord cette entreprise.");if(S.compare.some(x=>x.siren===siren)){toast("Déjà dans la comparaison.");route("compare");return}if(S.compare.length>=3)S.compare.shift();S.compare.push(c);save("fce_compare",S.compare);toast("Ajoutée à la comparaison.");renderCompare()}
function renderCompare(){const root=$("#compareRoot");if(!S.compare.length){root.innerHTML='<div class="state">Ajoute jusqu’à trois entreprises pour les comparer.</div>';return}root.innerHTML=`<div class="compare-picker">${S.compare.map((c,i)=>`<article class="compare-panel"><p class="eyebrow">ENTREPRISE ${i+1}</p><h3>${esc(c.name)}</h3><p class="muted">SIREN ${c.siren}</p><button class="button secondary" data-rm="${c.siren}">Retirer</button></article>`).join("")}${S.compare.length===1?'<article class="compare-panel"><p class="muted">Ajoute une seconde entreprise.</p></article>':""}</div>${S.compare.length>=2?tableMany(S.compare):""}`;root.querySelectorAll("[data-rm]").forEach(b=>b.onclick=()=>{S.compare=S.compare.filter(x=>x.siren!==b.dataset.rm);save("fce_compare",S.compare);renderCompare()})}
function tableMany(items){const defs=[["SIREN",c=>c.siren],["Statut",c=>c.status==="A"?"En activité":"Cessée"],["Activité",c=>c.activityLabel],["Ville",c=>c.city||"—"],["Code postal",c=>c.postalCode||"—"],["Création",c=>c.creation],["Catégorie",c=>c.category],["Effectif",c=>c.workforce]];return`<table class="compare-table"><thead><tr><th>Critère</th>${items.map(c=>`<th>${esc(c.name)}</th>`).join("")}</tr></thead><tbody>${defs.map(([label,get])=>`<tr><th>${label}</th>${items.map(c=>`<td>${esc(get(c))}</td>`).join("")}</tr>`).join("")}</tbody></table>`}
function showState(m){$("#searchState").textContent=m;$("#searchState").classList.remove("hidden")}
showState("Saisis un nom, un SIREN ou un mot-clé.");const restored=restoreFromUrl();if(restored.hasQuery){route("search");search(restored.page)}else{route("home")}
