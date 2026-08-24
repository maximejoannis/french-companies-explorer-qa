const data = {
  heroProof: [
    { value: '2+ ans', label: 'QA dédiée' },
    { value: '6+ ans', label: 'background dev' },
    { value: 'Près de 5 ans', label: 'Rôle hybride DEV/TEST' }
  ],
  principles: [
    { icon: 'fa-shield-halved', title: 'Approche par le risque', text: 'Prioriser ce qui protège le parcours métier et la décision de mise en production.' },
    { icon: 'fa-link', title: 'Traçabilité', text: 'Relier exigences, cas de test, anomalies, exécutions et rapports.' },
    { icon: 'fa-gears', title: 'Industrialisation', text: 'Automatiser là où le ROI, la stabilité et la répétabilité le justifient.' }
  ],
  experience: [
    { date: '2026 · présent', company: 'TRIYO LAB', title: 'Référent QA transverse & automatisation', desc: 'Pilotage de la stratégie de test, coordination des contributeurs QA et validation de moteurs de scoring côté UI et API. Automatisation Playwright et Pytest, conformité RGPD, matrices décisionnelles, CI/CD et traçabilité Jira / PR.', tags: ['Playwright','Pytest','FastAPI','Jira','CI/CD'], icon: 'fa-compass' },
    { date: '2025 · 2026', company: 'AMN Brains · SecPilot', title: 'QA — Validation de processus BPMN', desc: 'Stratégie N1/N2 sur cinq processus BPMN critiques, 53 tests et gestion de 11 anomalies dont 7 critiques, avec validation de non-régression avant mise en production.', tags: ['BPMN','Camunda / CIB Seven','GitLab','Functional QA'], icon: 'fa-diagram-project' },
    { date: '2021 · 2024', company: 'Infotel · Banque de France', title: 'Développeur Full Stack / Testeur fonctionnel', desc: 'Rôle hybride sur une application de cotation financière critique : analyse et validation d’anomalies, régression, tests unitaires systématiques, reporting batch et sécurisation des correctifs dans un cadre Agile.', tags: ['Java','AngularJS','JUnit','Jenkins','Postman'], icon: 'fa-building-columns' },
    { date: '2019 · 2021', company: 'Infotel · BNP Paribas', title: 'Back-End Java / Testeur technico-fonctionnel', desc: 'Validation de flux microservices et de 7 API internes dans un contexte DSP2 : tests REST, JSON/XML, statuts HTTP, cohérence SQL, logs, contrôles de sécurité et suivi qualité des releases.', tags: ['REST API','Postman','Java','SQL','DSP2'], icon: 'fa-code-branch' }
  ],
  projects: [
    {
      id: 'saucedemo', filters:['automation'], kind: 'Automation E2E', icon: 'fa-cart-shopping', a: '#fff7ed', b: '#ffedd5', c: '#ea580c',
      title: 'SauceDemo QA Automation',
      desc: 'Framework Playwright JavaScript sur les parcours e-commerce critiques, structuré avec Page Object Model, fixtures, qualité de code, rapports Allure et GitHub Actions.',
      tags: ['Playwright','JavaScript','POM','Allure','GitHub Actions'],
      repo: 'maximejoannis/saucedemo-qa-automation',
      metrics: [{value:'86', label:'scénarios automatisés'}, {value:'POM', label:'architecture'}],
      links: [
        {label:'Dépôt GitHub', url:'https://github.com/maximejoannis/saucedemo-qa-automation', icon:'fa-brands fa-github'},
        {label:'Portail QA', url:'https://maximejoannis.github.io/saucedemo-qa-automation/', icon:'fa-solid fa-chart-line'}
      ]
    },
    {
      id: 'restful', filters:['automation','api'], kind: 'UI + API', icon: 'fa-hotel', a: '#ecfeff', b: '#cffafe', c: '#0891b2',
      title: 'Restful Booker Playwright',
      desc: 'Framework TypeScript réunissant tests UI et API REST, Page Objects, modèles typés, scénarios CRUD et intégration GitHub Actions.',
      tags: ['Playwright','TypeScript','REST API','POM','CI/CD'],
      repo: 'maximejoannis/restful-booker-playwright',
      metrics: [{value:'UI + API', label:'double couche'}, {value:'TS', label:'type safety'}],
      links: [
        {label:'Dépôt GitHub', url:'https://github.com/maximejoannis/restful-booker-playwright', icon:'fa-brands fa-github'},
        {label:'Portail QA', url:'https://maximejoannis.github.io/restful-booker-playwright/', icon:'fa-solid fa-chart-line'}
      ]
    },
    {
      id: 'french-companies', filters:['automation','api'], kind: 'E2E + API + A11y', icon: 'fa-building', a: '#eef2ff', b: '#e0e7ff', c: '#4f46e5',
      title: 'French Companies Explorer — Playwright QA',
      desc: 'Démarche QA complète en Playwright et TypeScript : tests E2E, API, mockés, accessibilité, régression visuelle, CI et traçabilité ISTQB.',
      tags: ['Playwright','TypeScript','API','Accessibilité','Allure','ISTQB'],
      repo: 'maximejoannis/playwright-french-companies-explorer',
      metrics: [{value:'110', label:'exécutions automatisées'}, {value:'77,8 %', label:'couverture fonctionnelle'}, {value:'100 %', label:'couverture P0'}],
      links: [
        {label:'Dépôt GitHub', url:'https://github.com/maximejoannis/playwright-french-companies-explorer', icon:'fa-brands fa-github'},
        {label:'Portail QA', url:'https://maximejoannis.github.io/playwright-french-companies-explorer/', icon:'fa-solid fa-chart-line'}
      ]
    },
    {
      id:'saucedemo-v2', filters:['soon'], kind:'Bientôt', icon:'fa-cart-plus', a:'#f3f4f6', b:'#e5e7eb', c:'#9ca3af',
      title:'SauceDemo V2', desc:'Prochaine évolution du framework SauceDemo. Architecture, couverture et portail QA seront publiés à l’ouverture du projet.',
      tags:['Playwright','Evolution V2','Roadmap'], comingSoon:true
    },
    {
      id:'restful-v2', filters:['soon'], kind:'Bientôt', icon:'fa-code-merge', a:'#f3f4f6', b:'#e5e7eb', c:'#9ca3af',
      title:'Restful Booker V2', desc:'Nouvelle itération du projet UI + API. La carte restera volontairement inactive jusqu’à publication de la V2.',
      tags:['Playwright','API','Evolution V2'], comingSoon:true
    }
  ],
  stack: [
    { title:'Test Automation', items:[['fa-vial','Playwright'],['fa-python','Pytest'],['fa-code','JavaScript'],['fa-code','TypeScript'],['fa-file-code','Page Object Model'],['fa-arrows-rotate','Régression']] },
    { title:'QA & API', items:[['fa-list-check','ISTQB'],['fa-plug','REST API'],['fa-paper-plane','Postman'],['fa-robot','AI / Prompt Testing'],['fa-diagram-project','BPMN'],['fa-bug','Jira / Xray']] },
    { title:'CI/CD & Dev', items:[['fa-github','GitHub Actions'],['fa-git-alt','Git / GitLab'],['fa-chart-line','Allure'],['fa-java','Java / Spring'],['fa-database','SQL'],['fa-terminal','DevTools / CLI']] }
  ]
};

function tags(items){return items.map(x=>`<span class="tag">${x}</span>`).join('')}
function render(){
  document.querySelector('#heroProof').innerHTML=data.heroProof.map(x=>`<div class="proof-item"><strong>${x.value}</strong><span>${x.label}</span></div>`).join('');
  document.querySelector('#principles').innerHTML=data.principles.map(x=>`<article class="principle-card"><div class="principle-icon"><i class="fa-solid ${x.icon}"></i></div><div><h3>${x.title}</h3><p>${x.text}</p></div></article>`).join('');
  document.querySelector('#timeline').innerHTML=data.experience.map(x=>`<article class="timeline-item reveal"><div class="timeline-dot"><i class="fa-solid ${x.icon}"></i></div><div class="experience-card"><div class="experience-meta"><span>${x.date}</span><span>${x.company}</span></div><h3>${x.title}</h3><p>${x.desc}</p><div class="mini-tags">${tags(x.tags)}</div></div></article>`).join('');
  document.querySelector('#projectGrid').innerHTML=data.projects.map(projectCard).join('');
  document.querySelector('#stackGrid').innerHTML=data.stack.map(c=>`<article class="stack-category reveal"><h3>${c.title}</h3><div class="stack-items">${c.items.map(([icon,label])=>`<div class="stack-item"><i class="fa-solid ${icon}"></i><span>${label}</span></div>`).join('')}</div></article>`).join('');
}

function projectCard(x){
  const disabled = x.comingSoon ? ' coming-soon' : '';
  const metrics = (x.metrics||[]).map(m=>`<div class="metric"><strong>${m.value}</strong><span>${m.label}</span></div>`).join('');
  const stability = x.repo ? `<div class="metric stability-metric" data-stability-repo="${x.repo}" title="Taux de réussite calculé sur les 20 dernières exécutions GitHub Actions terminées"><strong>…</strong><span>stabilité pipeline · 20 runs</span></div>` : '';
  const links = x.comingSoon ? `<div class="coming-note"><i class="fa-regular fa-clock"></i> Arrive bientôt</div>` : `<div class="project-links">${x.links.map(l=>`<a class="project-action" href="${l.url}" ${l.url.startsWith('http')?'target="_blank" rel="noopener noreferrer"':''}><i class="${l.icon}"></i><span>${l.label}</span></a>`).join('')}</div>`;
  return `<article class="project-card reveal${disabled}" data-project-id="${x.id}" data-project-filters="${(x.filters||[]).join(' ')}" style="--project-a:${x.a};--project-b:${x.b};--project-icon:${x.c}"><div class="project-visual"><span class="project-badge">${x.kind}</span><i class="fa-solid ${x.icon}"></i>${x.comingSoon?'<span class="soon-overlay">BIENTÔT</span>':''}</div><div class="project-content"><h3><i class="fa-solid ${x.icon}"></i>${x.title}</h3><p>${x.desc}</p><div class="project-tags">${tags(x.tags)}</div><div class="project-metrics">${metrics}${stability}</div>${links}</div></article>`;
}


function initProjectFilters(){
  const toolbar=document.querySelector('#projectFilter');
  if(!toolbar) return;
  const buttons=[...toolbar.querySelectorAll('[data-project-filter]')];
  const status=document.querySelector('#projectFilterStatus');
  const cards=()=>[...document.querySelectorAll('#projectGrid .project-card')];

  const counts={all:data.projects.length};
  data.projects.forEach(project=>(project.filters||[]).forEach(filter=>counts[filter]=(counts[filter]||0)+1));
  toolbar.querySelectorAll('[data-filter-count]').forEach(node=>{node.textContent=counts[node.dataset.filterCount]||0});

  const applyFilter=(filter)=>{
    let visible=0;
    cards().forEach(card=>{
      const match=filter==='all'||card.dataset.projectFilters.split(/\s+/).includes(filter);
      card.classList.toggle('filtered-out',!match);
      card.setAttribute('aria-hidden',String(!match));
      if(match){
        visible++;
        card.classList.remove('filter-enter');
        requestAnimationFrame(()=>card.classList.add('filter-enter'));
      }
    });
    buttons.forEach(btn=>{
      const active=btn.dataset.projectFilter===filter;
      btn.classList.toggle('active',active);
      btn.setAttribute('aria-pressed',String(active));
    });
    status.textContent=`${visible} projet${visible>1?'s':''} affiché${visible>1?'s':''}`;
  };

  buttons.forEach(btn=>btn.addEventListener('click',()=>applyFilter(btn.dataset.projectFilter)));
}

async function loadPipelineStability(){
  const nodes=[...document.querySelectorAll('[data-stability-repo]')];
  await Promise.all(nodes.map(async node=>{
    const strong=node.querySelector('strong');
    try{
      const repo=node.dataset.stabilityRepo;
      const res=await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=20`,{headers:{Accept:'application/vnd.github+json'}});
      if(!res.ok) throw new Error(`GitHub API ${res.status}`);
      const json=await res.json();
      const runs=(json.workflow_runs||[]).slice(0,20).filter(r=>r.status==='completed');
      if(!runs.length){strong.textContent='N/D'; node.title='Aucune exécution GitHub Actions terminée parmi les 20 dernières.'; return;}
      const ok=runs.filter(r=>r.conclusion==='success').length;
      const pct=Math.round((ok/runs.length)*100);
      strong.textContent=`${pct}%`;
      node.title=`${ok} exécution(s) réussie(s) sur ${runs.length} exécution(s) terminée(s), parmi les 20 dernières GitHub Actions.`;
    }catch(err){
      strong.textContent='N/D';
      node.title='Donnée GitHub indisponible (API non joignable ou limite de requêtes atteinte).';
    }
  }));
}

function runTyping(){const el=document.querySelector('#typingGreeting'),text='Bonjour, je suis ';if(matchMedia('(prefers-reduced-motion: reduce)').matches){el.textContent=text;return}let i=0;function tick(){el.textContent=text.slice(0,++i);if(i<text.length)setTimeout(tick,48)}tick()}
function createFloatingIcons(){const holder=document.querySelector('#floatingIcons');const icons=[['fa-vial','#2563eb'],['fa-bug','#dc2626'],['fa-code','#7c3aed'],['fa-robot','#0ea5e9'],['fa-gears','#16a34a'],['fa-database','#ea580c'],['fa-shield-halved','#1e40af'],['fa-diagram-project','#0891b2']];holder.innerHTML=icons.map(([i,c],n)=>`<span class="floating-icon" style="left:${7+(n*13)%86}%;top:${10+(n*19)%75}%;--delay:-${n*.8}s;--dur:${8+n%4}s;--size:${24+(n%3)*10}px;--color:${c}"><i class="fa-solid ${i}"></i></span>`).join('')}
let observer;function initReveal(){observer?.disconnect();observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.12});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el))}
function initNavigation(){const nav=document.querySelector('#navbar'),top=document.querySelector('#toTop'),footer=document.querySelector('.site-footer');const sections=[...document.querySelectorAll('main section[id]')],links=[...document.querySelectorAll('.nav-links a')];const onScroll=()=>{nav?.classList.toggle('scrolled',scrollY>20);top?.classList.toggle('show',scrollY>500);let id='';sections.forEach(s=>{if(scrollY>=s.offsetTop-140)id=s.id});links.forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#${id}`))};addEventListener('scroll',onScroll,{passive:true});onScroll();top?.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));if(top&&footer){const observer=new IntersectionObserver(entries=>{top.classList.toggle('footer-hidden',entries.some(e=>e.isIntersecting))},{threshold:.08});observer.observe(footer)}}

document.addEventListener('DOMContentLoaded',()=>{createFloatingIcons();render();initProjectFilters();runTyping();initReveal();initNavigation();loadPipelineStability();});

function initContactForm(){
  const form=document.querySelector('#contactForm');
  if(!form) return;
  const status=document.querySelector('#contactStatus');
  const submit=form.querySelector('.form-submit');
  const endpoint=form.getAttribute('action')||'';

  const showStatus=(type,message)=>{
    status.className=`contact-status show ${type}`;
    status.innerHTML=message;
  };

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!form.reportValidity()) return;

    if(endpoint.includes('VOTRE_FORM_ID')){
      showStatus('setup','<i class="fa-solid fa-circle-info"></i> Le formulaire est prêt : remplacez <strong>VOTRE_FORM_ID</strong> dans <code>index.html</code> par l’identifiant fourni par Formspree pour activer l’envoi vers Gmail.');
      return;
    }

    submit.disabled=true;
    submit.classList.add('is-loading');
    status.className='contact-status';
    status.textContent='';

    try{
      const response=await fetch(endpoint,{method:'POST',body:new FormData(form),headers:{Accept:'application/json'}});
      if(response.ok){
        form.reset();
        showStatus('success','<i class="fa-solid fa-circle-check"></i> Merci ! Votre message a bien été envoyé. Je vous répondrai dès que possible.');
      }else{
        const payload=await response.json().catch(()=>({}));
        const detail=payload.errors?.map(e=>e.message).join(' ')||'Une erreur est survenue pendant l’envoi.';
        showStatus('error',`<i class="fa-solid fa-triangle-exclamation"></i> ${detail}`);
      }
    }catch(error){
      showStatus('error','<i class="fa-solid fa-wifi"></i> Impossible d’envoyer le message pour le moment. Vous pouvez aussi me contacter directement par email.');
    }finally{
      submit.disabled=false;
      submit.classList.remove('is-loading');
    }
  });
}

// Contact form is initialized after the portfolio UI is ready.
document.addEventListener('DOMContentLoaded',initContactForm);
