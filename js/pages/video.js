/* pages/video.js — Video Downloader */
import { createEl } from '../utils/dom.js';
import { icons } from '../ui/icons.js';

export function render() {
  const container = createEl('div', {}, []);
  container.appendChild(createEl('h1', {}, ['Video Downloader']));
  container.appendChild(createEl('p', { style: { color: 'var(--c-text-2)', marginBottom: 'var(--s-5)' } }, ['Paste a URL to extract and download videos.']));

  // Extract section
  const extractCard = createEl('div', { class: 'card', style: { maxWidth: '720px', margin: '0 auto var(--s-5)' } });
  extractCard.innerHTML = `
    <div class="card__head"><div class="card__title">Extract Video</div></div>
    <div style="display:flex;gap:var(--s-3);flex-wrap:wrap;">
      <input type="url" class="field__input" placeholder="https://youtube.com/watch?v=..." style="flex:1;min-width:200px;">
      <button class="btn btn--primary">${icons['search']} Extract</button>
    </div>
  `;
  container.appendChild(extractCard);

  // Extract result
  const resultCard = createEl('div', { class: 'card', style: { maxWidth: '720px', margin: '0 auto var(--s-5)' } });
  resultCard.innerHTML = `
    <div class="card__head"><div class="card__title">Video Info</div></div>
    <div style="display:flex;gap:var(--s-4);align-items:flex-start;flex-wrap:wrap;">
      <div style="width:160px;height:90px;background:var(--c-surface-2);border-radius:var(--radius);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--c-text-3);font-size:var(--text-xs);">Thumbnail</div>
      <div style="flex:1;min-width:200px;">
        <div style="font-weight:600;margin-bottom:var(--s-2);">Sample Video Title</div>
        <div style="font-size:var(--text-sm);color:var(--c-text-2);margin-bottom:var(--s-3);">Duration: 10:24 • Channel: Example</div>
        <div style="display:flex;gap:var(--s-2);flex-wrap:wrap;">
          <button class="btn btn--primary btn--sm">Download MP4</button>
          <button class="btn btn--secondary btn--sm">Audio Only (MP3)</button>
        </div>
      </div>
    </div>
    <div class="table-wrap" style="margin-top:var(--s-4);">
      <table class="table">
        <thead><tr><th>Quality</th><th>Format</th><th>Size</th><th></th></tr></thead>
        <tbody>
          <tr><td>1080p</td><td>MP4</td><td>~125 MB</td><td><button class="btn btn--primary btn--sm">Download</button></td></tr>
          <tr><td>720p</td><td>MP4</td><td>~85 MB</td><td><button class="btn btn--primary btn--sm">Download</button></td></tr>
          <tr><td>480p</td><td>MP4</td><td>~45 MB</td><td><button class="btn btn--primary btn--sm">Download</button></td></tr>
          <tr><td>Audio</td><td>MP3</td><td>~12 MB</td><td><button class="btn btn--secondary btn--sm">Download</button></td></tr>
        </tbody>
      </table>
    </div>
  `;
  container.appendChild(resultCard);

  // Active downloads
  const dlCard = createEl('div', { class: 'card', style: { maxWidth: '720px', margin: '0 auto' } });
  dlCard.innerHTML = `
    <div class="card__head"><div class="card__title">Active Downloads</div></div>
    <div style="display:flex;flex-direction:column;gap:var(--s-4);">
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--s-2);font-size:var(--text-sm);">
          <span style="font-weight:500;">video_169372.mp4</span>
          <span style="color:var(--c-text-3);">65%</span>
        </div>
        <div class="progress"><div class="progress__bar" style="width:65%;"></div></div>
        <div style="display:flex;justify-content:space-between;margin-top:var(--s-1);font-size:var(--text-xs);color:var(--c-text-3);">
          <span>2.4 MB/s</span><span>ETA 12s</span>
        </div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--s-2);font-size:var(--text-sm);">
          <span style="font-weight:500;">Sample_Audio.mp3</span>
          <span style="color:var(--c-text-3);">Completed</span>
        </div>
        <div class="progress progress--success"><div class="progress__bar" style="width:100%;"></div></div>
      </div>
    </div>
  `;
  container.appendChild(dlCard);

  return container;
}
