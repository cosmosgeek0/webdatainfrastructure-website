// All units here are decimal. Do not infer missing observations from a clock.
export const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function isFresh(data, elapsed = 0) {
  return data?.status === 'live' && finite(data.generated_ms) && finite(data.observed_ms)
    && data.generated_ms - data.observed_ms >= 0 && data.generated_ms - data.observed_ms + elapsed < 15000;
}
export function chartPoints(rows, minute = false) {
  return (Array.isArray(rows) ? rows : []).filter(row => Array.isArray(row) && finite(row[0])
    && finite(row[1]) && finite(row[2]) && (minute || finite(row[3]) && row[3] > 0))
    .map(row => ({t:row[0],rx:row[1]/1e6,tx:row[2]/1e6})).sort((a,b)=>a.t-b.t);
}
export function mergeSeconds(previous, data, revision, start) {
  const next=new Map(previous);
  // The API recomputes an overlapping tail, and a full window each minute.
  if(!revision || Math.floor(revision/60000)!==Math.floor(data.revision/60000))next.clear();
  else for(const at of next.keys())if(at>=Math.floor((revision-5000)/1000)*1000)next.delete(at);
  for(const p of chartPoints(data.points))next.set(p.t,p);
  for(const at of next.keys())if(at<start)next.delete(at);
  return next;
}
