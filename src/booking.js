export function initializeBooking(){
  const dialog=document.querySelector('#call-dialog'),form=document.querySelector('#call-form');
  const status=document.querySelector('#call-status'),send=document.querySelector('#send-call');
  const date=form.elements.date,time=form.elements.time,zone=form.elements.timezone;
  const detected=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const zones=[...new Set([detected,'UTC','Asia/Kolkata','Europe/London','Europe/Berlin','America/New_York','America/Los_Angeles','Asia/Singapore','Australia/Sydney'])];
  zones.forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value.replaceAll('_',' ');zone.append(option);});
  let opener=null,sending=false,dismissed=false;
  try{dismissed=sessionStorage.getItem('wdi-call-dismissed')==='1';}catch{}
  function localNow(){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone.value,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
    const get=key=>parts.find(part=>part.type===key).value;
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  }
  function dates(){date.min=localNow().slice(0,10);time.setCustomValidity('');}
  zone.addEventListener('change',dates);date.addEventListener('change',()=>time.setCustomValidity(''));time.addEventListener('input',()=>time.setCustomValidity(''));
  function open(trigger){
    if(dialog.open)return;opener=trigger||document.activeElement;dates();
    const selection=trigger?.dataset.enquiry;
    form.elements.enquiry.value=selection==='network'?'AI data network':'Residential node supply';
    form.elements.message.placeholder=selection==='network'?'Countries, scale, workload, timing and operating requirements':'Residential IP count, regions, permission, resources and pricing';
    dialog.showModal();
  }
  function close(){
    dialog.close();dismissed=true;
    try{sessionStorage.setItem('wdi-call-dismissed','1');}catch{}
    opener?.focus({preventScroll:true});
  }
  document.querySelectorAll('[data-open-call]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();open(button);}));
  document.querySelector('#close-call').addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
  const loaded=performance.now();
  document.addEventListener('mouseleave',event=>{
    if(!dismissed&&!document.querySelector('dialog[open]')&&event.clientY<=0&&scrollY>200&&performance.now()-loaded>20000&&matchMedia('(pointer:fine)').matches){dismissed=true;open(null);}
  });
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(sending)return;
    dates();
    if(Boolean(date.value)!==Boolean(time.value))time.setCustomValidity('Choose both a date and time, or leave both blank.');
    else if(date.value&&`${date.value}T${time.value}`<=localNow())time.setCustomValidity('Please propose a future time in the selected timezone.');
    if(!form.reportValidity())return;
    if(form.elements.company_site.value){status.textContent='Unable to submit this request. Please email us directly.';return;}
    sending=true;send.disabled=true;send.textContent='Sending…';status.textContent='';
    const payload={
      name:form.elements.name.value.trim(),email:form.elements.email.value.trim(),
      Company:form.elements.company.value.trim(),Enquiry:form.elements.enquiry.value,
      'Proposed date':date.value,'Proposed time':time.value,Timezone:zone.value,
      message:form.elements.message.value.trim(),
      _subject:'WDI enquiry — '+form.elements.enquiry.value,_template:'table',
      _url:'https://webdatainfrastructure.com/',_honey:''
    };
    try{
      const response=await fetch('https://formsubmit.co/ajax/contact@webdatainfrastructure.com',{
        method:'POST',referrerPolicy:'origin',headers:{'Content-Type':'application/json',Accept:'application/json'},
        body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)
      });
      const result=await response.json();
      if(/needs activation|confirm your email|check your email/i.test(result.message||'')){
        status.textContent='Email delivery is being activated. Please contact contact@webdatainfrastructure.com directly for now.';
      }else{
        if(!response.ok||!(result.success===true||result.success==='true'))throw new Error('Relay did not accept the request');
        status.textContent='Enquiry submitted. We’ll reply by email.';
        form.reset();zone.value=detected;dismissed=true;
        try{sessionStorage.setItem('wdi-call-dismissed','1');}catch{}
      }
    }catch{
      status.textContent='The request could not be sent. Your details are still here; try again or email contact@webdatainfrastructure.com.';
    }finally{sending=false;send.disabled=false;send.textContent='Send enquiry';}
  });
}
