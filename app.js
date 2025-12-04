/* SmartTask Kanban — app.js
   Single-file application logic. Persists to localStorage.
*/

const STORAGE_KEY = 'smarttask_kanban_v1';

// -- DOM references
const boardSelect = document.getElementById('boardSelect');
const boardsListUI = document.getElementById('boardsListUI');
const boardTitle = document.getElementById('boardTitle');
const boardMeta = document.getElementById('boardMeta');
const boardArea = document.getElementById('boardArea');
const addListBtn = document.getElementById('addListBtn');
const emptyState = document.getElementById('emptyState');
const emptyAddList = document.getElementById('emptyAddList');
const searchInput = document.getElementById('searchInput');
const labelFilter = document.getElementById('labelFilter');
const newBoardBtn = document.getElementById('newBoardBtn');
const boardsListButton = document.getElementById('openBoardList');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

const cardModal = document.getElementById('cardModal');
const closeModal = document.getElementById('closeModal');
const cardForm = document.getElementById('cardForm');
const cardTitleInput = document.getElementById('cardTitle');
const cardDescInput = document.getElementById('cardDesc');
const cardDueInput = document.getElementById('cardDue');
const labelChips = document.getElementById('labelChips');
const addLabelBtn = document.getElementById('addLabelBtn');
const checklistEl = document.getElementById('checklist');
const addCheckBtn = document.getElementById('addCheckBtn');
const newCheckText = document.getElementById('newCheckText');
const commentsEl = document.getElementById('comments');
const addCommentBtn = document.getElementById('addCommentBtn');
const newCommentText = document.getElementById('newCommentText');
const saveCardBtn = document.getElementById('saveCardBtn');
const deleteCardBtn = document.getElementById('deleteCardBtn');

const listTemplate = document.getElementById('listTemplate');
const cardTemplate = document.getElementById('cardTemplate');

// data model
let data = {
  boards: []
};
let activeBoardId = null;
let activeCardRef = null; // {listId, cardId}
let dragSrc = null;

// helpers
const uid = (len=8) => Math.random().toString(36).slice(2,2+len);

// seed sample board (only when no saved data)
const sampleData = {
  boards: [
    {
      id: uid(),
      title: 'Product Launch',
      lists: [
        { id: uid(), title: 'Backlog', cards: [
          { id: uid(), title: 'Define MVP', desc: 'Define the minimal viable product for launch', labels: ['Planning'], due: '', checklist:[], comments: [] },
          { id: uid(), title: 'Hero section design', desc: 'Design hero, CTA and value prop', labels: ['Design','High'], due: '', checklist:[], comments: [] },
        ]},
        { id: uid(), title: 'In Progress', cards: [
          { id: uid(), title: 'Implement auth', desc: 'Login, Signup and profile', labels: ['Dev'], due: '', checklist:[], comments: [] }
        ]},
        { id: uid(), title: 'Done', cards: [
          { id: uid(), title: 'Project kickoff', desc: 'Initial meetup and goals', labels: ['Meeting'], due: '', checklist:[], comments: [] }
        ]}
      ],
      labels: [
        { id: 'Planning', color: '#fbbf24' },
        { id: 'Design', color: '#60a5fa' },
        { id: 'High', color: '#fb7185' },
        { id: 'Dev', color: '#34d399' },
        { id: 'Meeting', color: '#c084fc' }
      ]
    }
  ]
};

// load/save
function loadData(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(raw){
    try{
      data = JSON.parse(raw);
      if(!data.boards || !Array.isArray(data.boards)) throw new Error('bad data');
    }catch(e){
      console.warn('Failed to parse storage, using sample', e);
      data = sampleData;
    }
  }else{
    data = sampleData;
  }
  if(data.boards.length) activeBoardId = data.boards[0].id;
}
function saveData(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// UI helpers
function getBoard(bid){ return data.boards.find(b=>b.id===bid) }
function getList(bid,lid){ const b=getBoard(bid); return b?.lists.find(l=>l.id===lid) }
function getCard(bid,lid,cid){ const l=getList(bid,lid); return l?.cards.find(c=>c.id===cid) }

// render
function renderBoardSelect(){
  boardSelect.innerHTML = '';
  data.boards.forEach(b=>{
    const o = document.createElement('option');
    o.value = b.id; o.textContent = b.title;
    boardSelect.appendChild(o);
  });
  if(activeBoardId) boardSelect.value = activeBoardId;
}

function renderBoardsListUI(){
  boardsListUI.innerHTML = '';
  data.boards.forEach(b=>{
    const li = document.createElement('li');
    li.textContent = b.title;
    li.onclick = () => { activeBoardId = b.id; render(); };
    boardsListUI.appendChild(li);
  });
}

function renderLabelFilter(){
  labelFilter.innerHTML = '<option value="">All labels</option>';
  const board = getBoard(activeBoardId);
  if(!board) return;
  board.labels.forEach(lbl=>{
    const o=document.createElement('option'); o.value=lbl.id; o.textContent=lbl.id; labelFilter.appendChild(o);
  });
}

function renderBoard(){
  boardArea.innerHTML = '';
  const board = getBoard(activeBoardId);
  if(!board){
    boardTitle.textContent = 'No board selected';
    boardMeta.textContent = '';
    return;
  }
  boardTitle.textContent = board.title;
  const totalLists = board.lists.length;
  const totalCards = board.lists.reduce((s,l)=>s + l.cards.length,0);
  boardMeta.textContent = `${totalLists} lists • ${totalCards} cards`;

  if(totalLists===0){
    emptyState.hidden = false;
  } else {
    emptyState.hidden = true;
  }

  board.lists.forEach(list=>{
    const node = listTemplate.content.cloneNode(true);
    const el = node.querySelector('.list');
    el.dataset.listId = list.id;
    el.querySelector('.list-title').textContent = list.title;

    const addCardBtn = el.querySelector('.add-card');
    const addCardFooter = el.querySelector('.add-card-footer');
    addCardBtn.onclick = () => promptAddCard(list.id);
    addCardFooter.onclick = () => promptAddCard(list.id);

    const cardsEl = el.querySelector('.cards');
    cardsEl.dataset.listId = list.id;

    // enable drop handlers
    cardsEl.addEventListener('dragover', ev => {
      ev.preventDefault();
      ev.currentTarget.dataset.dragover = 'true';
    });
    cardsEl.addEventListener('dragleave', ev => {
      ev.currentTarget.dataset.dragover = 'false';
    });
    cardsEl.addEventListener('drop', ev => {
      ev.preventDefault();
      ev.currentTarget.dataset.dragover = 'false';
      const cardId = ev.dataTransfer.getData('text/card');
      const srcListId = ev.dataTransfer.getData('text/srcList');
      if(!cardId) return;
      moveCard(activeBoardId, srcListId, cardId, list.id);
    });

    // render cards in order
    list.cards.forEach(card=>{
      const cnode = cardTemplate.content.cloneNode(true);
      const cel = cnode.querySelector('.card');
      cel.dataset.cardId = card.id;
      cel.dataset.listId = list.id;
      // labels
      const labs = cnode.querySelector('.card-labels');
      if(card.labels && card.labels.length){
        card.labels.forEach(lbl=>{
          const b = board.labels.find(l=>l.id===lbl);
          const pill = document.createElement('span');
          pill.className='label-pill';
          pill.textContent = lbl;
          pill.style.background = b?.color || '#ddd';
          labs.appendChild(pill);
        });
      }
      cnode.querySelector('.card-title').textContent = card.title;
      const meta = cnode.querySelector('.card-meta');
      meta.textContent = (card.due ? `Due: ${card.due}` : '') + (card.comments?.length ? ` • ${card.comments.length} comments` : '');
      // drag events
      cel.addEventListener('dragstart', ev=>{
        ev.dataTransfer.setData('text/card', card.id);
        ev.dataTransfer.setData('text/srcList', list.id);
        dragSrc = {listId:list.id, cardId:card.id};
        requestAnimationFrame(()=>cel.classList.add('dragging'));
      });
      cel.addEventListener('dragend', ev=>{
        cel.classList.remove('dragging');
        dragSrc = null;
      });

      cel.addEventListener('click', ev => openCardModal(list.id, card.id));
      cardsEl.appendChild(cnode);
    });

    boardArea.appendChild(el);
  });
}

// functionality
function promptAddList(){
  const title = prompt('List title') || 'Untitled';
  const board = getBoard(activeBoardId);
  board.lists.push({ id: uid(), title, cards: []});
  saveData();
  render();
}
function promptAddCard(listId){
  const title = prompt('Card title') || 'New card';
  const list = getList(activeBoardId, listId);
  list.cards.push({ id: uid(), title, desc:'', labels: [], due:'', checklist:[], comments:[] });
  saveData();
  render();
}

function moveCard(boardId, srcListId, cardId, dstListId){
  if(srcListId === dstListId) return;
  const src = getList(boardId, srcListId);
  const dst = getList(boardId, dstListId);
  const idx = src.cards.findIndex(c=>c.id===cardId);
  if(idx === -1) return;
  const [card] = src.cards.splice(idx,1);
  dst.cards.unshift(card);
  saveData();
  render();
}

// Card modal handling
function openCardModal(listId, cardId){
  activeCardRef = {listId, cardId};
  const board = getBoard(activeBoardId);
  const list = getList(activeBoardId, listId);
  const card = getCard(activeBoardId, listId, cardId);
  if(!card) return;
  // populate fields
  cardTitleInput.value = card.title;
  cardDescInput.value = card.desc || '';
  cardDueInput.value = card.due || '';
  // labels
  labelChips.innerHTML = '';
  board.labels.forEach(lbl=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'small';
    btn.textContent = lbl.id;
    btn.style.background = card.labels.includes(lbl.id) ? lbl.color : 'transparent';
    btn.onclick = () => toggleCardLabel(lbl.id);
    labelChips.appendChild(btn);
  });

  // checklist
  renderChecklist(card);
  renderComments(card);

  cardModal.setAttribute('aria-hidden','false');
}

function closeCardModal(){
  cardModal.setAttribute('aria-hidden','true');
  activeCardRef = null;
}

function toggleCardLabel(lblId){
  const {listId, cardId} = activeCardRef;
  const card = getCard(activeBoardId, listId, cardId);
  if(!card) return;
  const idx = card.labels.indexOf(lblId);
  if(idx === -1) card.labels.push(lblId);
  else card.labels.splice(idx,1);
  saveData();
  openCardModal(listId, cardId); // rerender modal
}

function renderChecklist(card){
  checklistEl.innerHTML = '';
  (card.checklist||[]).forEach((item, i)=>{
    const row = document.createElement('div');
    row.style.display='flex';row.style.gap='8px';row.style.alignItems='center';
    const cb = document.createElement('input'); cb.type='checkbox'; cb.checked = !!item.done;
    cb.onchange = () => { item.done = cb.checked; saveData(); render(); };
    const txt = document.createElement('div'); txt.textContent = item.text; if(item.done) txt.style.textDecoration='line-through';
    const del = document.createElement('button'); del.className='small'; del.textContent='Del'; del.onclick = ()=>{ card.checklist.splice(i,1); saveData(); openCardModal(activeCardRef.listId, activeCardRef.cardId); };
    row.appendChild(cb); row.appendChild(txt); row.appendChild(del);
    checklistEl.appendChild(row);
  });
}
addCheckBtn.onclick = () => {
  const val = newCheckText.value.trim(); if(!val) return;
  const {listId, cardId} = activeCardRef; const card = getCard(activeBoardId, listId, cardId);
  card.checklist.push({ text: val, done: false});
  newCheckText.value = ''; saveData(); openCardModal(listId, cardId);
};

function renderComments(card){
  commentsEl.innerHTML = '';
  (card.comments||[]).forEach((c, i)=>{
    const div = document.createElement('div'); div.style.padding='6px 0';
    div.innerHTML = `<strong style="color:var(--muted)">${c.author||'You'}</strong> <small style="color:var(--muted)">• ${new Date(c.ts).toLocaleString()}</small><div>${escapeHtml(c.text)}</div>`;
    commentsEl.appendChild(div);
  });
}
addCommentBtn.onclick = () => {
  const val = newCommentText.value.trim(); if(!val) return;
  const {listId, cardId} = activeCardRef; const card = getCard(activeBoardId, listId, cardId);
  card.comments.push({ author:'You', text: val, ts: Date.now() });
  newCommentText.value=''; saveData(); openCardModal(listId, cardId);
};

function saveCardFromModal(ev){
  ev.preventDefault();
  const {listId, cardId} = activeCardRef; const card = getCard(activeBoardId, listId, cardId);
  card.title = cardTitleInput.value.trim() || 'Untitled';
  card.desc = cardDescInput.value;
  card.due = cardDueInput.value;
  saveData(); closeCardModal(); render();
}

function deleteCardFromModal(){
  if(!confirm('Delete this card?')) return;
  const {listId, cardId} = activeCardRef;
  const list = getList(activeBoardId, listId);
  const idx = list.cards.findIndex(c=>c.id===cardId);
  if(idx>-1) list.cards.splice(idx,1);
  saveData(); closeCardModal(); render();
}

// add label to board
function addLabelToBoard(){
  const board = getBoard(activeBoardId);
  const name = prompt('Label name (short)') || `Label-${Date.now()}`;
  const color = prompt('Hex color (e.g. #f97316)') || '#9CA3AF';
  board.labels.push({ id: name, color });
  saveData();
  render();
}

// search & filter
function applySearchAndFilter(){
  const q = (searchInput.value || '').toLowerCase();
  const lf = labelFilter.value;
  const board = getBoard(activeBoardId);
  if(!board) return;
  // naive: hide cards that don't match
  board.lists.forEach(list=>{
    list.cards.forEach(card=>{
      card._hidden = false;
      if(q){
        const hay = `${card.title} ${card.desc} ${(card.labels||[]).join(' ')}`.toLowerCase();
        if(!hay.includes(q)) card._hidden = true;
      }
      if(lf){
        if(!(card.labels||[]).includes(lf)) card._hidden = true;
      }
    });
  });
  // re-render using hidden flag
  boardArea.querySelectorAll('.cards').forEach(cardsEl=>{
    const lid = cardsEl.dataset.listId;
    const list = getList(activeBoardId,lid);
    if(!list) return;
    cardsEl.innerHTML = '';
    list.cards.forEach(card=>{
      if(card._hidden) return;
      const cnode = cardTemplate.content.cloneNode(true);
      const cel = cnode.querySelector('.card');
      cel.dataset.cardId = card.id;
      cel.dataset.listId = list.id;
      const labs = cnode.querySelector('.card-labels');
      if(card.labels && card.labels.length){
        card.labels.forEach(lbl=>{
          const b = board.labels.find(l=>l.id===lbl);
          const pill = document.createElement('span');
          pill.className='label-pill';
          pill.textContent = lbl;
          pill.style.background = b?.color || '#ddd';
          labs.appendChild(pill);
        });
      }
      cnode.querySelector('.card-title').textContent = card.title;
      const meta = cnode.querySelector('.card-meta');
      meta.textContent = (card.due ? `Due: ${card.due}` : '') + (card.comments?.length ? ` • ${card.comments.length} comments` : '');
      cel.addEventListener('click', ev => openCardModal(list.id, card.id));
      // dnd
      cel.addEventListener('dragstart', ev=>{
        ev.dataTransfer.setData('text/card', card.id);
        ev.dataTransfer.setData('text/srcList', list.id);
        dragSrc = {listId:list.id, cardId:card.id};
      });
      cardsEl.appendChild(cnode);
    });
  });

  // update meta counts
  const totalLists = board.lists.length;
  const totalCards = board.lists.reduce((s,l)=>s + l.cards.filter(c=>!c._hidden).length,0);
  boardMeta.textContent = `${totalLists} lists • ${totalCards} visible cards`;
}

// utils
function escapeHtml(s=''){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]) }

// board-level actions
function createNewBoard(){
  const title = prompt('Board name') || `Board ${data.boards.length+1}`;
  const b = { id: uid(), title, lists: [], labels: [] };
  data.boards.unshift(b);
  activeBoardId = b.id;
  saveData(); render();
}
function deleteBoard(bid){
  if(!confirm('Delete board? This cannot be undone.')) return;
  const idx = data.boards.findIndex(b=>b.id===bid);
  if(idx>-1) data.boards.splice(idx,1);
  activeBoardId = data.boards[0]?.id || null;
  saveData(); render();
}

function exportData(){
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'smarttask_backup.json'; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}
function importDataFromFile(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const obj = JSON.parse(e.target.result);
      if(!obj.boards) throw new Error('Invalid file');
      data = obj;
      activeBoardId = data.boards[0]?.id || null;
      saveData(); render();
      alert('Data imported');
    }catch(err){ alert('Failed to import: ' + err.message) }
  };
  reader.readAsText(file);
}

// boot / events
function render(){
  renderBoardSelect();
  renderBoardsListUI();
  renderLabelFilter();
  renderBoard();
}

loadData();
render();

// listeners
addListBtn.addEventListener('click', promptAddList);
emptyAddList.addEventListener('click', promptAddList);
boardSelect.addEventListener('change', (e)=>{ activeBoardId = e.target.value; render(); });
searchInput.addEventListener('input', () => { render(); applySearchAndFilter(); });
labelFilter.addEventListener('change', applySearchAndFilter);
newBoardBtn.addEventListener('click', createNewBoard);
boardsListButton.addEventListener('click', ()=>{ document.querySelector('.sidebar').classList.toggle('open'); });

cardModal.addEventListener('click', (e)=>{ if(e.target === cardModal) closeCardModal(); });
closeModal.addEventListener('click', closeCardModal);
cardForm.addEventListener('submit', saveCardFromModal);
deleteCardBtn.addEventListener('click', deleteCardFromModal);
addLabelBtn.addEventListener('click', addLabelToBoard);

exportBtn.addEventListener('click', exportData);
importBtn.addEventListener('click', ()=> importFile.click());
importFile.addEventListener('change', (e)=> importDataFromFile(e.target.files[0]));

// save periodically
setInterval(saveData, 5000);

// keyboard: Esc closes modal
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape') {
    if(cardModal.getAttribute('aria-hidden') === 'false') closeCardModal();
  }
});
